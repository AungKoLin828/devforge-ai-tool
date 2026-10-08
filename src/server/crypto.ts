import crypto from "node:crypto";
const secret = () => process.env.SESSION_SECRET || "development-only-change-me";
export const randomToken = () => crypto.randomBytes(32).toString("base64url");
export const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const encrypt = (value: string) => {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(secret()).digest();
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return [
    iv.toString("base64url"),
    c.getAuthTag().toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
};
export const decrypt = (value: string) => {
  const [ivS, tagS, dataS] = value.split(".");
  if (!ivS || !tagS || !dataS) throw new Error("Invalid encrypted value");
  const key = crypto.createHash("sha256").update(secret()).digest();
  const d = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivS, "base64url"),
  );
  d.setAuthTag(Buffer.from(tagS, "base64url"));
  return Buffer.concat([
    d.update(Buffer.from(dataS, "base64url")),
    d.final(),
  ]).toString("utf8");
};
