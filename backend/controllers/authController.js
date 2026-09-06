const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const UAParser = require("ua-parser-js");
const User = require("../models/User");
const {
  recordFailedLogin,
  clearFailedLogins,
} = require("../middleware/rateLimiter");
const {
  sendOtpEmail,
  sendLoginNotification,
  sendSecurityAlert,
  sendPasswordResetEmail,
} = require("../services/emailService");
const {
  generateOtp,
  verifyOtp,
  canResendOtp,
  createPendingSession,
  getPendingSession,
  deletePendingSession,
} = require("../services/otpService");
const {
  getGoogleAuthUrl,
  validateState,
  exchangeCodeForUserInfo,
  findOrCreateGoogleUser,
} = require("../services/googleAuthService");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Generate JWT Token (30d if rememberMe is true, 1d if false)
const generateToken = (id, rememberMe = true) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: rememberMe !== false ? "30d" : "1d",
  });
};

// Parse client device and connection info for security emails
const getClientInfo = (req) => {
  const parser = new UAParser(req.headers["user-agent"]);
  const result = parser.getResult();
  const ip = req.ip || req.connection?.remoteAddress || "Unknown";
  const browser = result.browser.name
    ? `${result.browser.name} ${result.browser.version || ""}`.trim()
    : "Unknown Browser";
  const os = result.os.name
    ? `${result.os.name} ${result.os.version || ""}`.trim()
    : "Unknown OS";
  const device = result.device.model
    ? `${result.device.vendor || ""} ${result.device.model}`.trim()
    : result.device.type || "Desktop";
  const time = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return { ip, browser, os, device, time };
};

// Format user response object
const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  userType: user.userType,
  address: user.address || "",
  profileImage: user.profileImage || "",
  shopName: user.shopName || "",
  authProvider: user.authProvider,
});

// ---------------------------------------------------------------------------
// Standard Authentication
// ---------------------------------------------------------------------------

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      userType,
      address,
      aadharNumber,
      shopName,
    } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Validate for seller requiring aadhar and shopName
    if (userType === "seller") {
      if (!aadharNumber) {
        return res.status(400).json({
          success: false,
          message: "Aadhar number is required for sellers",
        });
      }
      if (!shopName) {
        return res.status(400).json({
          success: false,
          message: "Shop name is required for sellers",
        });
      }
    }

    // Create user
    const userData = {
      name,
      email,
      phone,
      password,
      userType,
      address,
      authProvider: "local",
      twoFactorEnabled: process.env.TWO_FACTOR_ENABLED !== "false",
    };

    // Add seller-specific fields if userType is seller
    if (userType === "seller") {
      userData.aadharNumber = aadharNumber;
      userData.shopName = shopName;
    }

    const user = await User.create(userData);

    if (user) {
      res.status(201).json({
        success: true,
        message: "Registration successful",
        token: generateToken(user._id),
        user: formatUserResponse(user),
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid user data",
      });
    }
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Login user (with 2FA trigger if enabled)
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user by email
    const user = await User.findOne({ email }).select("+password");

    // Check if user exists and password matches
    if (user && (await user.matchPassword(password))) {
      const clientIp = res.locals._rateLimitIp || req.ip;
      const normalizedEmail =
        res.locals._rateLimitEmail || email.trim().toLowerCase();

      // Clear failed login counter on success
      clearFailedLogins(clientIp, normalizedEmail);

      // Check if 2FA is required
      const is2faActive =
        process.env.TWO_FACTOR_ENABLED !== "false" &&
        user.twoFactorEnabled !== false;

      if (is2faActive) {
        // Create pending 2FA session in Redis (storing rememberMe state)
        const sessionId = await createPendingSession(
          user._id.toString(),
          clientIp,
          req.headers["user-agent"],
          rememberMe
        );

        if (!sessionId) {
          // If Redis session creation failed, fall back to direct login
          console.warn("[AUTH] Failed to create 2FA session, falling back to direct login");
        } else {
          // Generate and email OTP
          const otpData = await generateOtp(user._id.toString());
          if (otpData) {
            // Asynchronously dispatch email
            sendOtpEmail(user.email, otpData.otp, user.name).catch((err) =>
              console.error("[AUTH] Error sending OTP email:", err.message)
            );
          }

          // Return pending session to frontend (no JWT issued yet)
          const maskedEmail = user.email.replace(
            /(.{2})(.*)(?=@)/,
            (_, a, b) => a + "*".repeat(b.length)
          );

          return res.json({
            success: true,
            requiresTwoFactor: true,
            sessionId,
            emailPreview: maskedEmail,
            message: "OTP has been sent to your registered email",
          });
        }
      }

      // If 2FA is not enabled or failed over: Issue JWT directly
      user.lastLoginAt = new Date();
      user.lastLoginIp = clientIp;
      await user.save();

      // Send login notification
      const clientInfo = getClientInfo(req);
      sendLoginNotification(user.email, user.name, clientInfo).catch((err) =>
        console.error("[AUTH] Error sending login notification:", err.message)
      );

      return res.json({
        success: true,
        token: generateToken(user._id, rememberMe !== false),
        user: formatUserResponse(user),
      });
    } else {
      // Record failed login for exponential backoff
      const clientIp = res.locals._rateLimitIp || req.ip;
      const normalizedEmail =
        res.locals._rateLimitEmail ||
        (email ? email.trim().toLowerCase() : null);
      recordFailedLogin(clientIp, normalizedEmail);

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ---------------------------------------------------------------------------
// Two-Factor Authentication (OTP)
// ---------------------------------------------------------------------------

// @desc    Verify 2FA OTP and issue JWT
// @route   POST /api/auth/2fa/verify
// @access  Public
exports.verifyTwoFactor = async (req, res) => {
  try {
    const { sessionId, otp } = req.body;

    if (!sessionId || !otp) {
      return res.status(400).json({
        success: false,
        message: "Session ID and OTP are required",
      });
    }

    // Retrieve pending session
    const session = await getPendingSession(sessionId);
    if (!session) {
      return res.status(400).json({
        success: false,
        errorType: "SESSION_EXPIRED",
        message: "Your login session has expired. Please log in again.",
      });
    }

    // Verify OTP against stored hash
    const result = await verifyOtp(session.userId, otp.toString().trim());

    if (!result.success) {
      if (result.error === "expired") {
        return res.status(400).json({
          success: false,
          errorType: "OTP_EXPIRED",
          message: "The OTP has expired. Please request a new one.",
        });
      }

      if (result.error === "too_many_attempts") {
        await deletePendingSession(sessionId);
        return res.status(400).json({
          success: false,
          errorType: "TOO_MANY_ATTEMPTS",
          message: "Too many incorrect attempts. Please log in again to generate a new OTP.",
        });
      }

      return res.status(400).json({
        success: false,
        errorType: "INVALID_OTP",
        message: "Invalid verification code. Please check and try again.",
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    // OTP verified: Clean up session
    await deletePendingSession(sessionId);

    // Retrieve user and generate token
    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    // Dispatch login notification email
    const clientInfo = getClientInfo(req);
    sendLoginNotification(user.email, user.name, clientInfo).catch((err) =>
      console.error("[AUTH] Error sending login notification:", err.message)
    );

    // Check rememberMe preference (from request body or pending session)
    const isRemembered =
      req.body.rememberMe !== undefined
        ? req.body.rememberMe !== false
        : session.rememberMe !== false;

    return res.json({
      success: true,
      message: "Two-factor verification successful",
      token: generateToken(user._id, isRemembered),
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("2FA Verify Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during 2FA verification",
    });
  }
};

// @desc    Resend 2FA OTP
// @route   POST /api/auth/2fa/resend
// @access  Public
exports.resendOtp = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Retrieve pending session
    const session = await getPendingSession(sessionId);
    if (!session) {
      return res.status(400).json({
        success: false,
        errorType: "SESSION_EXPIRED",
        message: "Your login session has expired. Please log in again.",
      });
    }

    // Check resend cooldown
    const cooldown = await canResendOtp(session.userId);
    if (!cooldown.canResend) {
      return res.status(429).json({
        success: false,
        errorType: "COOLDOWN_ACTIVE",
        message: `Please wait ${cooldown.waitSeconds} seconds before requesting a new OTP.`,
        waitSeconds: cooldown.waitSeconds,
      });
    }

    // Find user
    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    // Generate new OTP (invalidates old one)
    const otpData = await generateOtp(session.userId);
    if (!otpData) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate OTP. Please try again.",
      });
    }

    // Send new OTP email
    await sendOtpEmail(user.email, otpData.otp, user.name);

    return res.json({
      success: true,
      message: "A new verification code has been sent to your email.",
      expiresIn: otpData.expiresIn,
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resending OTP",
    });
  }
};

// ---------------------------------------------------------------------------
// Google OAuth 2.0
// ---------------------------------------------------------------------------

// @desc    Redirect to Google OAuth consent
// @route   GET /api/auth/google
// @access  Public
exports.googleAuth = async (req, res) => {
  try {
    const authData = await getGoogleAuthUrl();
    if (!authData) {
      return res.status(500).json({
        success: false,
        message:
          "Google OAuth is not configured. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      });
    }

    res.redirect(authData.url);
  } catch (error) {
    console.error("Google Auth Redirect Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate Google authentication",
    });
  }
};

// @desc    Handle Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  try {
    const { code, state, error } = req.query;

    if (error) {
      console.warn("[GOOGLE AUTH] User cancelled or error:", error);
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(
          "Google authentication was cancelled"
        )}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(
          "Invalid OAuth response from Google"
        )}`
      );
    }

    // Validate anti-CSRF state
    const isValidState = await validateState(state);
    if (!isValidState) {
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(
          "Session validation failed. Please try again."
        )}`
      );
    }

    // Exchange authorization code for user details
    const googleProfile = await exchangeCodeForUserInfo(code);
    if (!googleProfile) {
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(
          "Failed to retrieve profile from Google"
        )}`
      );
    }

    // Find, create, or link account
    const { user, isNewUser, isLinked } = await findOrCreateGoogleUser(
      googleProfile
    );

    // If account was newly linked to an existing password-based account, send a security alert
    if (isLinked) {
      sendSecurityAlert(
        user.email,
        user.name,
        "A Google Sign-In account was linked to your existing Krishak Shayak account."
      ).catch((err) =>
        console.error("[AUTH] Security alert send error:", err.message)
      );
    }

    // Check if 2FA is explicitly enabled for Google sign-in
    const requireGoogle2fa = process.env.TWO_FACTOR_GOOGLE === "true";

    if (requireGoogle2fa && user.twoFactorEnabled !== false) {
      const sessionId = await createPendingSession(
        user._id.toString(),
        req.ip,
        req.headers["user-agent"]
      );

      if (sessionId) {
        const otpData = await generateOtp(user._id.toString());
        if (otpData) {
          sendOtpEmail(user.email, otpData.otp, user.name).catch((err) =>
            console.error("[AUTH] Error sending OTP email:", err.message)
          );
        }

        return res.redirect(
          `${frontendUrl}/login?twoFactor=true&sessionId=${sessionId}`
        );
      }
    }

    // Successful Google Authentication: Issue JWT
    const token = generateToken(user._id);

    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    // Send login notification
    const clientInfo = getClientInfo(req);
    sendLoginNotification(user.email, user.name, clientInfo).catch((err) =>
      console.error("[AUTH] Error sending login notification:", err.message)
    );

    // Redirect to frontend callback handler with token and user data
    const userJson = encodeURIComponent(
      JSON.stringify(formatUserResponse(user))
    );

    return res.redirect(
      `${frontendUrl}/auth/google/callback?token=${token}&user=${userJson}`
    );
  } catch (error) {
    console.error("Google Callback Error:", error);
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(
        "Authentication failed. Please try again."
      )}`
    );
  }
};

// ---------------------------------------------------------------------------
// User Profile & Logout
// ---------------------------------------------------------------------------

// @desc    Get current authenticated user
// @route   GET /api/auth/me or GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user) {
      res.json(formatUserResponse(user));
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Logout user (client-side state clearance confirmation)
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
};

// ---------------------------------------------------------------------------
// Password Reset Flow
// ---------------------------------------------------------------------------

// @desc    Request password reset link
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide an email address",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (user) {
      // Generate reset token and save to user
      const resetToken = user.getResetPasswordToken();
      await user.save({ validateBeforeSave: false });

      // Construct reset URL for frontend
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      // Dispatch reset email asynchronously
      sendPasswordResetEmail(user.email, resetUrl, user.name).catch((err) =>
        console.error("[AUTH] Error sending password reset email:", err.message)
      );
    }

    // Always return generic response to prevent account enumeration
    return res.json({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing password reset request",
    });
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    // Hash the token from URL parameter to match database hash
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with matching, unexpired reset token
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset link is invalid or has expired",
      });
    }

    // Set new password (pre-save hook will hash it)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Clear any failed login counters in Redis
    clearFailedLogins(req.ip, user.email);

    // Send confirmation security alert email
    sendSecurityAlert(
      user.email,
      user.name,
      "Your Krishak Shayak account password was successfully reset. If you did not make this change, please contact support immediately."
    ).catch((err) =>
      console.error("[AUTH] Error sending password reset alert:", err.message)
    );

    return res.json({
      success: true,
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resetting password",
    });
  }
};

