export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
});
export const error = (message, status = 400) => json({ success: false, message }, status);
export async function body(req) {
    try {
        return (await req.json());
    }
    catch {
        throw new Error("Invalid JSON body");
    }
}
export const methodNotAllowed = (allowed) => json({ success: false, message: "Method not allowed" }, 405, {
    allow: allowed.join(", "),
});
