import crypto from "crypto";

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    "0.0.0.0"
  );
}

export function hashIp(ip) {
  const secret = process.env.IP_HASH_SECRET || "change-me";
  return crypto
    .createHmac("sha256", secret)
    .update(String(ip))
    .digest("hex");
}