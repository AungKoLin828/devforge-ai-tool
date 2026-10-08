export const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
export const error = (message: string, status = 400) =>
  json({ success: false, message }, status);
export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
export const methodNotAllowed = (allowed: string[]) =>
  json({ success: false, message: "Method not allowed" }, 405, {
    allow: allowed.join(", "),
  });
