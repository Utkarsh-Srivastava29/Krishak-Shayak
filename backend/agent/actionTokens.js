const crypto = require("crypto");

/**
 * Write actions proposed by the agent are not executed until the farmer taps
 * Confirm. The proposal travels to the browser and back, so it is signed:
 * the server only executes exactly what it proposed, for the same user,
 * within 15 minutes.
 */
const TTL_MS = 15 * 60 * 1000;

const secret = () => process.env.AGENT_ACTION_SECRET || process.env.JWT_SECRET || "dev-only-secret";

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const signAction = ({ type, args, userId }, now = Date.now()) => {
  const payload = { type, args, userId: userId ? String(userId) : null, exp: now + TTL_MS };
  const body = b64(payload);
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
};

/** Returns the action payload, or throws if the token is forged or expired. */
const verifyAction = (token, { userId, now = Date.now() } = {}) => {
  const [body, signature] = (token || "").split(".");
  if (!body || !signature) throw new Error("Malformed action token");

  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Invalid action signature");

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp < now) throw new Error("This action has expired. Please ask again.");
  if (payload.userId && payload.userId !== String(userId)) throw new Error("Action belongs to another user");
  return payload;
};

module.exports = { signAction, verifyAction, TTL_MS };
