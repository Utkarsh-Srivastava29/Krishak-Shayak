const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Attaches req.user when a valid Bearer token is sent, and carries on as a
 * guest otherwise. Used by the assistant, which works for everyone but only
 * remembers signed-in farmers.
 */
exports.optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return next();

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("_id name userType location");
  } catch {
    req.user = null;
  }
  next();
};
