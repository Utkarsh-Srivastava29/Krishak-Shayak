const crypto = require("crypto");

/**
 * Verifies the `Upstash-Signature` header QStash adds to every request.
 * The header is an HS256 JWT signed with the project's current (or, during
 * key rotation, next) signing key. Its claims include:
 *   iss  "Upstash"
 *   sub  the destination URL
 *   exp / nbf
 *   body base64url(SHA-256(raw request body))
 *
 * Implemented with Node's crypto so no extra package is needed.
 */
const base64UrlDecode = (part) => Buffer.from(part, "base64url");
const stripPadding = (value = "") => value.replace(/=+$/, "");

const verifyWithKey = (token, key) => {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = crypto.createHmac("sha256", key).update(`${header}.${payload}`).digest("base64url");
  const a = Buffer.from(stripPadding(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return JSON.parse(base64UrlDecode(payload).toString("utf8"));
};

/**
 * Throws if the request did not come from QStash.
 * @param {string} signature  Upstash-Signature header
 * @param {Buffer|string} rawBody exact request body bytes
 * @param {object} opts { url, now, keys }
 */
const verifyQstashSignature = (signature, rawBody, opts = {}) => {
  if (!signature) throw new Error("Missing Upstash-Signature header");

  const keys = (opts.keys || [process.env.QSTASH_CURRENT_SIGNING_KEY, process.env.QSTASH_NEXT_SIGNING_KEY]).filter(Boolean);
  if (keys.length === 0) throw new Error("QStash signing keys are not configured");

  const claims = keys.map((key) => verifyWithKey(signature, key)).find(Boolean);
  if (!claims) throw new Error("Invalid QStash signature");

  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (claims.iss !== "Upstash") throw new Error("Invalid QStash issuer");
  if (claims.exp && now > claims.exp) throw new Error("QStash signature expired");
  if (claims.nbf && now < claims.nbf - 5) throw new Error("QStash signature not yet valid");
  if (opts.url && claims.sub && claims.sub !== opts.url) throw new Error("QStash signature is for a different URL");

  const bodyHash = crypto.createHash("sha256").update(rawBody || "").digest("base64url");
  if (stripPadding(claims.body) !== stripPadding(bodyHash)) throw new Error("QStash body hash mismatch");

  return claims;
};

module.exports = { verifyQstashSignature };
