import type { Context, Config } from "@netlify/functions";
import { handleApi } from "../../src/server/router.js";
export default async (req: Request, _context: Context) => {
  const r = await handleApi(req);
  const h = new Headers(r.headers);
  h.set("cache-control", "no-store");
  return new Response(r.body, {
    status: r.status,
    statusText: r.statusText,
    headers: h,
  });
};
export const config: Config = { path: "/api/*" };
