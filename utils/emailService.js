/**
 * Email Service
 *
 * Handles sending emails for authentication and notifications.
 * Uses Nodemailer to send emails via SMTP.
 *
 * Configuration via environment variables:
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com, smtp.office365.com)
 * - SMTP_PORT: SMTP server port (e.g., 587 for TLS, 465 for SSL)
 * - SMTP_SECURE: Use SSL (true for port 465, false for port 587)
 * - SMTP_USER: Email account username/email
 * - SMTP_PASS: Email account password or app password
 */

const nodemailer = require("nodemailer");
const crypto = require("crypto");
const {
  accessCodeTemplates,
  notificationTemplates,
  alertTemplates,
  emailSubjects,
} = require("../config/emailTemplates");

// Create transporter instance
let transporter = null;

/**
 * Initialize email transporter
 * Called once at startup to configure SMTP
 */
function initializeTransporter() {
  if (transporter) return transporter; // Already initialized

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // Check if SMTP is configured
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    console.warn("⚠️  SMTP not configured - emails will not be sent");
    console.warn("   Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS");
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    console.log(`✅ Email service initialized - using ${smtpHost}:${smtpPort}`);
    return transporter;
  } catch (error) {
    console.error("❌ Failed to initialize email transporter:", error);
    return null;
  }
}

/**
 * Generate a random 6-character access code
 * @returns {string} 6-character alphanumeric code (uppercase)
 */
function generateAccessCode() {
  // Generate a random GUID and take the last 6 characters
  const guid = crypto.randomUUID();
  return guid.substring(guid.length - 6).toUpperCase();
}

/**
 * Send access code email to user
 *
 * @param {string} email - Recipient email address
 * @param {string} accessCode - 6-character access code
 * @returns {Promise<boolean>} True if email sent successfully
 */
async function sendAccessCodeEmail(email, accessCode) {
  try {
    if (!transporter) {
      transporter = initializeTransporter();
    }

    if (!transporter) {
      console.warn("⚠️  Email service not configured - access code not sent");
      return false;
    }

    const emailBody = accessCodeTemplates.loginAccessCode(accessCode);
    const subject = emailSubjects.accessCodeTemplates.loginAccessCode();

    const mailOptions = {
      from: process.env.SMTP_EMAIL_FROM,
      to: email,
      subject,
      html: emailBody,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(
      `✅ Access code email sent to ${email} (ID: ${info.messageId})`,
    );
    return true;
  } catch (error) {
    console.error("❌ Error sending access code email:", error);
    return false;
  }
}

/**
 * Send general notification email
 *
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} body - HTML email body
 * @returns {Promise<boolean>} True if email sent successfully
 */
async function sendEmail(to, subject, body) {
  try {
    if (!transporter) {
      transporter = initializeTransporter();
    }

    if (!transporter) {
      console.warn("⚠️  Email service not configured - email not sent");
      return false;
    }

    const mailOptions = {
      from: process.env.SMTP_EMAIL_FROM,
      to,
      subject,
      html: body,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent to ${to} (ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
}

/**
 * Send welcome email to new user
 *
 * @param {string} email - Recipient email
 * @param {string} userName - User's display name
 * @returns {Promise<boolean>} True if email sent successfully
 */
async function sendWelcomeEmail(email, userName) {
  try {
    const appName = process.env.APP_NAME || "Streamline Dental Lab";
    const emailBody = notificationTemplates.welcomeUser(userName, appName);
    const subject = emailSubjects.notificationTemplates.welcomeUser(appName);

    return await sendEmail(email, subject, emailBody);
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    return false;
  }
}

/**
 * Send case status update notification
 *
 * @param {string} email - Recipient email
 * @param {string} caseId - Case ID
 * @param {string} patientName - Patient name
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @returns {Promise<boolean>} True if email sent successfully
 */
async function sendCaseStatusUpdate(
  email,
  caseId,
  patientName,
  oldStatus,
  newStatus,
) {
  try {
    const appName = process.env.APP_NAME || "Streamline Dental Lab";
    const emailBody = notificationTemplates.caseStatusUpdate(
      caseId,
      patientName,
      oldStatus,
      newStatus,
      appName,
    );
    const subject = emailSubjects.notificationTemplates.caseStatusUpdate;

    return await sendEmail(email, subject, emailBody);
  } catch (error) {
    console.error("❌ Error sending case status update email:", error);
    return false;
  }
}

/**
 * Send failed login attempt alert
 *
 * @param {string} email - Recipient email
 * @param {string} username - Username of account
 * @param {string} ipAddress - IP address of failed attempt
 * @returns {Promise<boolean>} True if email sent successfully
 */
async function sendFailedLoginAlert(email, username, ipAddress) {
  try {
    const appName = process.env.APP_NAME || "Streamline Dental Lab";
    const emailBody = alertTemplates.failedLoginAttempt(
      username,
      ipAddress,
      appName,
    );
    const subject = emailSubjects.alertTemplates.failedLoginAttempt(appName);

    return await sendEmail(email, subject, emailBody);
  } catch (error) {
    console.error("❌ Error sending failed login alert:", error);
    return false;
  }
}

/**
 * Test SMTP connection
 * Useful for debugging email configuration issues
 *
 * @returns {Promise<boolean>} True if connection successful
 */
async function testSmtpConnection() {
  try {
    if (!transporter) {
      transporter = initializeTransporter();
    }

    if (!transporter) {
      console.error("❌ Email transporter not initialized");
      return false;
    }

    await transporter.verify();
    console.log("✅ SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("❌ SMTP connection failed:", error);
    return false;
  }
}

module.exports = {
  initializeTransporter,
  generateAccessCode,
  sendAccessCodeEmail,
  sendEmail,
  sendWelcomeEmail,
  sendCaseStatusUpdate,
  sendFailedLoginAlert,
  testSmtpConnection,
};
