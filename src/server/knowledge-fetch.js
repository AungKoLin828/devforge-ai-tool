import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
function isPrivateIPv4(address) {
    const [a, b, c] = address.split(".").map(Number);
    return (a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0 && c === 0) ||
        (a === 192 && b === 0 && c === 2) ||
        (a === 192 && b === 88 && c === 99) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113) ||
        a >= 224);
}
function isPrivateIPv6(address) {
    const normalized = address.toLowerCase().split("%")[0];
    return (normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        /^fe[89ab]/.test(normalized) ||
        normalized.startsWith("::ffff:") ||
        normalized.startsWith("2001:db8:") ||
        normalized.startsWith("ff"));
}
async function resolvePublicAddresses(hostname) {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (normalized === "localhost" ||
        normalized.endsWith(".localhost") ||
        normalized.endsWith(".local") ||
        normalized.endsWith(".internal") ||
        isIP(normalized)) {
        throw new Error("Public URL must use a public DNS hostname.");
    }
    let addresses;
    try {
        addresses = await lookup(normalized, { all: true, verbatim: true });
    }
    catch {
        throw new Error("Public URL hostname could not be resolved.");
    }
    if (!addresses.length ||
        addresses.some(({ address, family }) => family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address))) {
        throw new Error("Public URL hostname must resolve only to public IP addresses.");
    }
    return addresses;
}
function decodeHtmlEntities(value) {
    const named = {
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        nbsp: " ",
        quot: '"',
    };
    return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code) => {
        if (code[0] !== "#")
            return named[code.toLowerCase()] ?? entity;
        const radix = code[1].toLowerCase() === "x" ? 16 : 10;
        const digits = code.slice(radix === 16 ? 2 : 1);
        const point = Number.parseInt(digits, radix);
        return Number.isInteger(point) && point > 0 && point <= 0x10ffff
            ? String.fromCodePoint(point)
            : entity;
    });
}
function extractText(content, contentType) {
    if (/text\/html/i.test(contentType)) {
        return decodeHtmlEntities(content
            .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
            .replace(/<!--[\s\S]*?-->/g, " ")
            .replace(/<(br|hr|\/p|\/div|\/li|\/h[1-6]|\/pre|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
            .replace(/<[^>]*>/g, " "))
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }
    if (/^text\//i.test(contentType) ||
        /application\/(json|xml|x-yaml|yaml)/i.test(contentType)) {
        return content.trim();
    }
    throw new Error("Public URL must return a text, JSON, XML, YAML, or HTML document.");
}
/** Fetch an HTTPS page with DNS pinning, redirect blocking, and a hard response-size limit. */
export async function fetchPublicText(urlValue, maxBytes = 512 * 1024) {
    let url;
    try {
        url = new URL(urlValue);
    }
    catch {
        throw new Error("Enter a valid public HTTPS URL.");
    }
    if (url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443")) {
        throw new Error("Public URLs must use HTTPS without credentials or a custom port.");
    }
    const addresses = await resolvePublicAddresses(url.hostname);
    const response = await new Promise((resolve, reject) => {
        const request = httpsRequest(url, {
            method: "GET",
            headers: {
                accept: "text/html,text/plain,text/markdown,application/json,application/xml,text/xml,application/yaml",
                "user-agent": "CodeviaAI-KnowledgeImporter/1.0",
            },
            lookup: (_hostname, options, callback) => {
                const family = typeof options === "object" ? options.family : options;
                const matching = addresses.filter((address) => !family || !address.family || address.family === family);
                if (!matching.length) {
                    callback(new Error("Public URL hostname has no usable address."), "", 0);
                    return;
                }
                if (typeof options === "object" && options.all) {
                    callback(null, matching);
                }
                else {
                    callback(null, matching[0].address, matching[0].family);
                }
            },
        }, (incoming) => {
            if (incoming.statusCode === undefined ||
                incoming.statusCode < 200 ||
                incoming.statusCode >= 300) {
                incoming.resume();
                reject(new Error(incoming.statusCode && incoming.statusCode >= 300 && incoming.statusCode < 400
                    ? "Public URL redirects are not followed. Add the final HTTPS URL instead."
                    : `Public URL request failed with HTTP ${incoming.statusCode ?? "unknown"}.`));
                return;
            }
            const contentLength = Number(incoming.headers["content-length"] || 0);
            if (contentLength > maxBytes) {
                incoming.destroy();
                reject(new Error("Public document exceeds the 512 KB import limit."));
                return;
            }
            const chunks = [];
            let totalBytes = 0;
            incoming.on("data", (chunk) => {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                totalBytes += buffer.length;
                if (totalBytes > maxBytes) {
                    incoming.destroy(new Error("Public document exceeds the 512 KB import limit."));
                    return;
                }
                chunks.push(buffer);
            });
            incoming.on("error", reject);
            incoming.on("end", () => {
                resolve({
                    body: Buffer.concat(chunks).toString("utf8"),
                    contentType: String(incoming.headers["content-type"] || ""),
                });
            });
        });
        request.setTimeout(15000, () => request.destroy(new Error("Public URL request timed out.")));
        request.on("error", reject);
        request.end();
    });
    const text = extractText(response.body, response.contentType).slice(0, maxBytes);
    if (!text)
        throw new Error("Public URL did not contain readable text.");
    return text;
}
