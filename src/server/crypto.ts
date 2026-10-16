import crypto from "node:crypto";

// Derive a stable encryption key from SESSION_SECRET; configure a strong value outside development.
const secret = () => process.env.SESSION_SECRET || "development-only-change-me";

/** Create a cryptographically random opaque token for sessions and pairing. */
export const randomToken = () => crypto.randomBytes(32).toString("base64url");

/** Hash a token before storing it so the database never contains its usable value. */
export const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

/** Encrypt a value with AES-256-GCM and package the IV, tag, and ciphertext. */
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

/** Authenticate and decrypt a value written by encrypt(). */
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
