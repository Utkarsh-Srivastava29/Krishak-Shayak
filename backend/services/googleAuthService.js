const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const { getRawRedisClient, isRedisReady } = require("../config/redisClient");
const User = require("../models/User");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || "http://localhost:5001/api/auth/google/callback";

const SCOPES = ["openid", "email", "profile"];
const STATE_TTL = 600; // 10 minutes

// ---------------------------------------------------------------------------
// OAuth2 Client
// ---------------------------------------------------------------------------

let oauth2Client = null;

const getOAuth2Client = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl =
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:5001/api/auth/google/callback";

  if (oauth2Client) return oauth2Client;
  oauth2Client = new OAuth2Client(clientId, clientSecret, callbackUrl);
  return oauth2Client;
};

// ---------------------------------------------------------------------------
// OAuth flow helpers
// ---------------------------------------------------------------------------

/**
 * Generates the Google OAuth consent URL with anti-CSRF state parameter.
 * The state is stored in Redis for server-side validation.
 *
 * @returns {{ url: string, state: string } | null}
 */
const getGoogleAuthUrl = async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[GOOGLE AUTH] ❌ Google OAuth credentials not configured");
    return null;
  }

  const state = crypto.randomBytes(32).toString("hex");

  // Store state in Redis for CSRF validation
  if (isRedisReady()) {
    const redis = getRawRedisClient();
    await redis.setex(`oauth_state:${state}`, STATE_TTL, "valid");
  }

  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "select_account", // Always show account chooser
  });

  return { url, state };
};

/**
 * Validates the OAuth state parameter to prevent CSRF attacks.
 *
 * @param {string} state - The state parameter from Google's callback
 * @returns {boolean}
 */
const validateState = async (state) => {
  if (!state) return false;
  if (!isRedisReady()) return true; // Fail open if Redis is down

  try {
    const redis = getRawRedisClient();
    const key = `oauth_state:${state}`;
    const value = await redis.get(key);

    if (value === "valid") {
      await redis.del(key); // One-time use
      return true;
    }

    return false;
  } catch (error) {
    console.error("[GOOGLE AUTH] Error validating state:", error.message);
    return false;
  }
};

/**
 * Exchanges an authorization code for tokens and extracts user info.
 *
 * @param {string} code - The authorization code from Google
 * @returns {{ googleId, email, name, picture, emailVerified } | null}
 */
const exchangeCodeForUserInfo = async (code) => {
  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);

    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      console.warn("[GOOGLE AUTH] ⚠️ Google email not verified");
      return null;
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || payload.email.split("@")[0],
      picture: payload.picture || "",
      emailVerified: payload.email_verified,
    };
  } catch (error) {
    console.error("[GOOGLE AUTH] Error exchanging code:", error.message);
    return null;
  }
};

/**
 * Finds an existing user or creates a new one based on Google profile.
 * Handles three scenarios:
 * 1. User with matching googleId → authenticate
 * 2. User with matching email but no googleId → link Google account
 * 3. No matching user → create new account
 *
 * @param {Object} googleProfile - { googleId, email, name, picture, emailVerified }
 * @returns {{ user: Object, isNewUser: boolean, isLinked: boolean }}
 */
const findOrCreateGoogleUser = async (googleProfile) => {
  const { googleId, email, name, picture } = googleProfile;

  // 1. Check if user exists with this Google ID
  let user = await User.findOne({ googleId });
  if (user) {
    // Update profile image if changed
    if (picture && user.profileImage !== picture) {
      user.profileImage = picture;
      await user.save();
    }
    return { user, isNewUser: false, isLinked: false };
  }

  // 2. Check if user exists with this email (registered via password)
  user = await User.findOne({ email });
  if (user) {
    // Link Google account to existing user
    user.googleId = googleId;
    user.profileImage = picture || user.profileImage;
    user.emailVerified = true;
    await user.save();

    console.log(`[GOOGLE AUTH] Linked Google account to existing user: ${email}`);
    return { user, isNewUser: false, isLinked: true };
  }

  // 3. Create new user with Google profile
  user = await User.create({
    name,
    email,
    googleId,
    authProvider: "google",
    profileImage: picture,
    emailVerified: true,
    userType: "buyer", // Default role for Google sign-ups
    twoFactorEnabled: false, // Google already has 2FA
  });

  console.log(`[GOOGLE AUTH] Created new user via Google: ${email}`);
  return { user, isNewUser: true, isLinked: false };
};

module.exports = {
  getGoogleAuthUrl,
  validateState,
  exchangeCodeForUserInfo,
  findOrCreateGoogleUser,
};
