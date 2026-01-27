/**
 * Email Service
 *
 * Handles sending emails for authentication and notifications.
 * Configure your email provider (SendGrid, AWS SES, Nodemailer, etc.)
 */

const crypto = require("crypto");

/**
 * Generate a random 6-character access code
 * @returns {string} 6-character alphanumeric code
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
    // TODO: Implement actual email sending using your email service provider
    // Options: SendGrid, AWS SES, Nodemailer with SMTP, etc.

    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Streamline Dental Lab - Login Access Code</h2>
          <p>Hello,</p>
          <p>Please enter the following 6-character code into the login form:</p>
          <div style="
            width: 150px;
            text-align: center;
            padding: 20px 10px;
            border: 2px solid #333;
            margin: 20px auto;
            font-size: 24px;
            font-weight: bold;
            background-color: #f5f5f5;
            letter-spacing: 3px;
          ">
            ${accessCode}
          </div>
          <p>This code will allow you to complete your login from this device.</p>
          <p>If you did not request this code, please ignore this email.</p>
          <br/>
          <p>Best regards,<br/>Streamline Dental Lab</p>
        </body>
      </html>
    `;

    const emailSubject = "Streamline Login - Access Code Required";

    console.log("=== EMAIL SERVICE ===");
    console.log(`To: ${email}`);
    console.log(`Subject: ${emailSubject}`);
    console.log(`Access Code: ${accessCode}`);
    console.log("=====================");

    // TEMPORARY: Log to console during development
    // In production, implement actual email sending
    // Example with nodemailer:
    /*
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: emailSubject,
      html: emailBody
    });
    */

    // For now, return true to simulate successful email sending
    return true;
  } catch (error) {
    console.error("Error sending access code email:", error);
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
    console.log("=== EMAIL SERVICE ===");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("=====================");

    // TODO: Implement actual email sending
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

module.exports = {
  generateAccessCode,
  sendAccessCodeEmail,
  sendEmail,
};
