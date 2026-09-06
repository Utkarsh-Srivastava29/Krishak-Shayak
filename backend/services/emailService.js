const nodemailer = require("nodemailer");

// ---------------------------------------------------------------------------
// Email transport configuration
// ---------------------------------------------------------------------------

let transporter = null;

/**
 * Creates and returns the Nodemailer transporter singleton.
 * Configurable via environment variables for any SMTP provider.
 */
const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true", // true for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

/**
 * Sends an email. Logs errors but never throws — email failures
 * should not break the authentication flow.
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[EMAIL] ⚠️  Email credentials not configured. Skipping email send.");
    return false;
  }

  try {
    const transport = getTransporter();
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

    await transport.sendMail({ from, to, subject, html });
    console.log(`[EMAIL] ✅ Email sent to ${to}: "${subject}"`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] ❌ Failed to send email to ${to}:`, error.message);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

/**
 * Sends an OTP verification email.
 * @param {string} email - Recipient email
 * @param {string} otp - The plain-text OTP (only used in the email body)
 * @param {string} name - User's display name
 */
const sendOtpEmail = async (email, otp, name) => {
  const subject = "Your Krishak Shayak Verification Code";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0fdf4;">
      <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #15803d, #166534); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">🌾 Krishak Shayak</h1>
          <p style="color: #fde68a; margin: 8px 0 0; font-size: 14px;">Verify Your Identity</p>
        </div>
        <div style="background: #ffffff; padding: 32px 24px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Hello <strong>${name || "User"}</strong>,</p>
          <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">Use the following verification code to complete your login:</p>
          <div style="background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #15803d; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px;">⏱ This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px;">If you didn't request this code, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            This is an automated message from Krishak Shayak. Please do not reply.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
};

/**
 * Sends a login notification email.
 * @param {string} email - Recipient email
 * @param {string} name - User's display name
 * @param {Object} loginDetails - { ip, browser, os, device, time }
 */
const sendLoginNotification = async (email, name, loginDetails) => {
  const { ip, browser, os, device, time } = loginDetails;
  const subject = "New Login Detected — Krishak Shayak";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0fdf4;">
      <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #15803d, #166534); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">🌾 Krishak Shayak</h1>
          <p style="color: #fde68a; margin: 8px 0 0; font-size: 14px;">Login Notification</p>
        </div>
        <div style="background: #ffffff; padding: 32px 24px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Hello <strong>${name || "User"}</strong>,</p>
          <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">A new login was detected on your account.</p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #6b7280; font-size: 13px; padding: 6px 0;">📅 Time</td><td style="color: #374151; font-size: 13px; padding: 6px 0; text-align: right;">${time}</td></tr>
              <tr><td style="color: #6b7280; font-size: 13px; padding: 6px 0;">🌐 IP Address</td><td style="color: #374151; font-size: 13px; padding: 6px 0; text-align: right;">${ip || "Unknown"}</td></tr>
              <tr><td style="color: #6b7280; font-size: 13px; padding: 6px 0;">🖥 Browser</td><td style="color: #374151; font-size: 13px; padding: 6px 0; text-align: right;">${browser || "Unknown"}</td></tr>
              <tr><td style="color: #6b7280; font-size: 13px; padding: 6px 0;">💻 Operating System</td><td style="color: #374151; font-size: 13px; padding: 6px 0; text-align: right;">${os || "Unknown"}</td></tr>
              ${device ? `<tr><td style="color: #6b7280; font-size: 13px; padding: 6px 0;">📱 Device</td><td style="color: #374151; font-size: 13px; padding: 6px 0; text-align: right;">${device}</td></tr>` : ""}
            </table>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
            <p style="color: #dc2626; font-size: 13px; margin: 0; font-weight: 600;">⚠️ If this wasn't you:</p>
            <p style="color: #991b1b; font-size: 13px; margin: 8px 0 0;">Please change your password immediately and secure your account.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            This is an automated security notification from Krishak Shayak.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
};

/**
 * Sends a security alert email (e.g., Google account linked).
 * @param {string} email - Recipient email
 * @param {string} name - User's display name
 * @param {string} details - Description of the security event
 */
const sendSecurityAlert = async (email, name, details) => {
  const subject = "Security Alert — Krishak Shayak";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #fef2f2;">
      <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626, #991b1b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">🌾 Krishak Shayak</h1>
          <p style="color: #fecaca; margin: 8px 0 0; font-size: 14px;">Security Alert</p>
        </div>
        <div style="background: #ffffff; padding: 32px 24px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Hello <strong>${name || "User"}</strong>,</p>
          <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">${details}</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
            <p style="color: #dc2626; font-size: 13px; margin: 0;">If you did not perform this action, please change your password immediately and contact support.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            This is an automated security notification from Krishak Shayak.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
};

/**
 * Sends a password reset email with secure one-time link.
 * @param {string} email - Recipient email
 * @param {string} resetUrl - Frontend reset URL with token
 * @param {string} name - User's display name
 */
const sendPasswordResetEmail = async (email, resetUrl, name) => {
  const subject = "Password Reset Request — Krishak Shayak";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0fdf4;">
      <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #15803d, #166534); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">🌾 Krishak Shayak</h1>
          <p style="color: #fde68a; margin: 8px 0 0; font-size: 14px;">Password Reset Request</p>
        </div>
        <div style="background: #ffffff; padding: 32px 24px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Hello <strong>${name || "User"}</strong>,</p>
          <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">We received a request to reset your password for your Krishak Shayak account. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${resetUrl}" style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);">Reset Password</a>
          </div>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 12px;">If the button above does not work, copy and paste this link into your browser:</p>
          <p style="color: #16a34a; font-size: 12px; word-break: break-all; margin: 0 0 20px;">${resetUrl}</p>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px;">⏱ This link will expire in <strong>15 minutes</strong>.</p>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            This is an automated security notification from Krishak Shayak.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendLoginNotification,
  sendSecurityAlert,
  sendPasswordResetEmail,
};
