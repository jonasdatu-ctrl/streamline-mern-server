/**
 * Email Templates Module
 *
 * Centralized location for all email templates used throughout the application.
 * This makes templates easy to find, edit, and maintain in one place.
 *
 * Organization:
 * - Access code templates
 * - Notification templates
 * - Alert templates
 */

// =============================================================================
// ACCESS CODE TEMPLATES
// =============================================================================

const accessCodeTemplates = {
  /**
   * Access code email for IP-based authentication
   * Used when user logs in from a new device/location
   */
  loginAccessCode: (accessCode) => `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Streamline Dental - Login Access Code</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">Hello,</p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Please enter the following 6-character code into the login form to complete your authentication:
          </p>
          
          <div style="
            width: 200px;
            text-align: center;
            padding: 25px;
            border: 2px solid #007bff;
            margin: 30px auto;
            font-size: 32px;
            font-weight: bold;
            background-color: #f0f8ff;
            letter-spacing: 5px;
            font-family: 'Courier New', monospace;
            color: #007bff;
          ">
            ${accessCode}
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            This code verifies that you are logging in from a new device or location. 
            After successful verification, you won't need to enter a code from this IP address again.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; line-height: 1.6;">
            <strong>Security Note:</strong> If you did not request this code, please do not share it with anyone. 
            Your account security is important to us.
          </p>
          
          <p style="color: #999; font-size: 12px; line-height: 1.6;">
            Best regards,<br/>
            Streamline Dental Security Team
          </p>
        </div>
      </body>
    </html>
  `,
};

// =============================================================================
// NOTIFICATION TEMPLATES
// =============================================================================

const notificationTemplates = {
  /**
   * Welcome email for new users
   */
  welcomeUser: (userName, appName = "Streamline Dental Lab") => `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to ${appName}!</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Welcome to ${appName}. Your account has been successfully created.
          </p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            You can now log in to access your account and manage your cases.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; line-height: 1.6;">
            If you have any questions, please contact our support team.
          </p>
          
          <p style="color: #999; font-size: 12px; line-height: 1.6;">
            Best regards,<br/>
            ${appName} Team
          </p>
        </div>
      </body>
    </html>
  `,

  /**
   * Case status update notification
   */
  caseStatusUpdate: (
    caseId,
    patientName,
    oldStatus,
    newStatus,
    appName = "Streamline Dental Lab",
  ) => `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Case Status Update</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">Hello,</p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Case <strong>#${caseId}</strong> for patient <strong>${patientName}</strong> has been updated.
          </p>
          
          <div style="background-color: #f0f8ff; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0;">
            <p style="margin: 0; color: #666;">
              <strong>Previous Status:</strong> ${oldStatus}
            </p>
            <p style="margin: 10px 0 0 0; color: #666;">
              <strong>New Status:</strong> <span style="color: #28a745; font-weight: bold;">${newStatus}</span>
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            Log in to your account to view more details about this case.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; line-height: 1.6;">
            Best regards,<br/>
            ${appName} Team
          </p>
        </div>
      </body>
    </html>
  `,
};

// =============================================================================
// ALERT TEMPLATES
// =============================================================================

const alertTemplates = {
  /**
   * Failed login attempt alert
   */
  failedLoginAttempt: (
    username,
    ipAddress,
    appName = "Streamline Dental Lab",
  ) => `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #d32f2f; margin-bottom: 20px;">⚠️ Failed Login Attempt</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">Hello,</p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            We detected a failed login attempt on your account.
          </p>
          
          <div style="background-color: #ffebee; padding: 20px; border-left: 4px solid #d32f2f; margin: 20px 0;">
            <p style="margin: 0; color: #666;">
              <strong>Username:</strong> ${username}
            </p>
            <p style="margin: 10px 0 0 0; color: #666;">
              <strong>IP Address:</strong> ${ipAddress}
            </p>
            <p style="margin: 10px 0 0 0; color: #666;">
              <strong>Time:</strong> ${new Date().toLocaleString()}
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            <strong>If this wasn't you:</strong> Please change your password immediately.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; line-height: 1.6;">
            For security reasons, we recommend changing your password if you don't recognize this IP address.
          </p>
          
          <p style="color: #999; font-size: 12px; line-height: 1.6;">
            Best regards,<br/>
            ${appName} Security Team
          </p>
        </div>
      </body>
    </html>
  `,
};

// =============================================================================
// EMAIL SUBJECTS
// =============================================================================

const emailSubjects = {
  accessCodeTemplates: {
    loginAccessCode: `Streamline login`,
  },
  notificationTemplates: {
    welcomeUser: `Welcome to Streamline Dental`,
    caseStatusUpdate: "Case Status Update",
  },
  alertTemplates: {
    failedLoginAttempt: 'Failed Login Attempt Alert',
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  accessCodeTemplates,
  notificationTemplates,
  alertTemplates,
  emailSubjects,
};
