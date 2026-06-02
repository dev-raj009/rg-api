// lib/config.js
import crypto from "crypto";

export const BASE_URL = "https://rgvikramjeetapi.classx.co.in";

export const BASE_HEADERS = {
  accept: "*/*",
  "auth-key": "appxapi",
  "client-service": "Appx",
  source: "website",
  origin: "https://rankersgurukul.com",
  referer: "https://rankersgurukul.com/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

export function makeHeaders(token, userId) {
  return {
    ...BASE_HEADERS,
    authorization: String(token),
    "user-id": String(userId),
  };
}

export function decrypt(enc) {
  try {
    if (!enc) return null;
    const [data, iv_b64] = enc.split(":");
    const ciphertext = Buffer.from(data, "base64");
    const iv = Buffer.from(iv_b64, "base64");
    const key = Buffer.from("638udh3829162018");
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf-8");
  } catch {
    return null;
  }
}
