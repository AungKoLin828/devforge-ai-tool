/** Serialize a JSON response while allowing route-specific status and headers. */
export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
});
/** Use the API's standard error response shape. */
export const error = (message, status = 400) => json({ success: false, message }, status);
/** Parse a request body and replace parser details with a stable client error. */
export async function body(req) {
    try {
        return (await req.json());
    }
    catch {
        throw new Error("Invalid JSON body");
    }
}
/** Advertise allowed HTTP methods using a consistent JSON response. */
export const methodNotAllowed = (allowed) => json({ success: false, message: "Method not allowed" }, 405, {
    allow: allowed.join(", "),
});
