/**
 * Authentication Routes
 *
 * Handles user authentication endpoints with IP-based access control:
 * - POST /auth/login - Username/password authentication with optional access code
 * - POST /auth/logout - Session cleanup
 *
 * IP-Based Security for Admin/Employee Users:
 * - First login from unknown IP: Sends 6-digit access code to email
 * - User must re-login with access code to verify
 * - Subsequent logins from that IP: Direct access without code
 *
 * Returns JWT tokens for authenticated users.
 */

const express = require("express");
const crypto = require("crypto");
const { sequelize } = require("../config/database");
const { hashPassword } = require("../utils/md5Hash");
const { generateToken } = require("../utils/authUtils");
const {
  generateAccessCode,
  sendAccessCodeEmail,
} = require("../utils/emailService");
const {
  userQueries,
  ipAccessQueries,
  adminSessionQueries,
  loggingQueries,
} = require("../config/queries");

const router = express.Router();

// Normalize and extract client IP, handling IPv6 loopback and x-forwarded-for
const getClientIp = (req) => {
  const normalizeIp = (ip) => {
    if (!ip) return "unknown";
    if (ip === "::1") return "127.0.0.1";
    if (ip.startsWith("::ffff:")) return ip.substring(7);
    return ip;
  };

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = forwarded.split(",").map((p) => p.trim()).find(Boolean);
    if (first) return normalizeIp(first);
  }

  const directIp =
    req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || "unknown";
  return normalizeIp(directIp);
};

/**
 * POST /auth/login
 *
 * Authenticates user with username, password, and optional access code.
 * Implements IP-based security for Admin/Employee users (UserTypeID 1 or 3).
 *
 * Request body:
 * {
 *   "username": "string",
 *   "password": "string",
 *   "accessCode": "string (optional, 6 characters)"
 * }
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": {
 *     "token": "JWT token",
 *     "user": { ... }
 *   }
 * }
 *
 * Response when access code required (200):
 * {
 *   "status": "access_code_required",
 *   "message": "We have sent an access code to your email",
 *   "data": {
 *     "email": "masked email"
 *   }
 * }
 *
 * Response on error (400/401/500):
 * {
 *   "status": "error",
 *   "message": "Error description"
 * }
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password, accessCode } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        status: "error",
        message: "Username and password are required",
      });
    }

    // Trim whitespace
    const trimmedUsername = String(username).trim();
    const trimmedPassword = String(password).trim();
    const trimmedAccessCode = accessCode ? String(accessCode).trim() : null;

    if (trimmedUsername.length === 0 || trimmedPassword.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Username and password cannot be empty",
      });
    }

    // Get client IP address
    const ipAddress = getClientIp(req);

    // Hash password using MD5 with Classic ASP compatibility
    let passwordHash;
    try {
      passwordHash = hashPassword(trimmedPassword);
    } catch (hashError) {
      console.error("Password hashing error:", hashError);
      return res.status(500).json({
        status: "error",
        message: "An error occurred during authentication",
      });
    }

    // Get user with full details
    const userResult = await sequelize.query(userQueries.getUserWithDetails, {
      replacements: { username: trimmedUsername, password: passwordHash },
      type: sequelize.QueryTypes.SELECT,
      raw: true,
    });

    if (!userResult || userResult.length === 0) {
      // Log failed login attempt
      await sequelize.query(loggingQueries.logFailedLoginAttempt, {
        replacements: { username: trimmedUsername, ipAddress },
        type: sequelize.QueryTypes.INSERT,
      });

      return res.status(401).json({
        status: "error",
        message: "Invalid username or password",
      });
    }

    const user = userResult[0];

    // Check if user is Admin (1) or Employee (3) - requires IP verification
    const requiresIpVerification =
      user.UserTypeID === 1 || user.UserTypeID === 3;

    if (!requiresIpVerification) {
      // Regular user - direct login without IP verification
      const token = generateToken({
        UserId: user.UserID,
        UserLogin: user.UserLogin,
        UserName: user.UserName,
      });

      return res.status(200).json({
        status: "success",
        data: {
          token,
          user: {
            UserId: user.UserID,
            UserLogin: user.UserLogin,
            UserName: user.UserName,
            UserFName: user.UserFName,
            UserLName: user.UserLName,
            UserTypeID: user.UserTypeID,
            CustomerID: user.CustomerID,
          },
        },
      });
    }

    // Admin/Employee - Check if access code is provided
    if (trimmedAccessCode) {
      // Verify access code
      const accessCodeResult = await sequelize.query(
        ipAccessQueries.verifyAccessCode,
        {
          replacements: { accessCode: trimmedAccessCode },
          type: sequelize.QueryTypes.SELECT,
          raw: true,
        },
      );

      if (!accessCodeResult || accessCodeResult.length === 0) {
        return res.status(401).json({
          status: "error",
          message: "Invalid access code",
        });
      }

      // Update IP permission - approve this IP and clear access code
      await sequelize.query(
        ipAccessQueries.updateIpPermissionAfterVerification,
        {
          replacements: {
            ipAddress,
            accessCode: trimmedAccessCode,
          },
          type: sequelize.QueryTypes.UPDATE,
        },
      );

      console.log(
        `IP ${ipAddress} approved for user ${user.UserLogin} after access code verification`,
      );
    } else {
      // No access code provided - check if IP is approved
      const ipApprovedResult = await sequelize.query(
        ipAccessQueries.checkIpApproved,
        {
          replacements: { ipAddress },
          type: sequelize.QueryTypes.SELECT,
          raw: true,
        },
      );

      const isIpApproved = ipApprovedResult && ipApprovedResult.length > 0;

      if (!isIpApproved) {
        // IP not approved - need to send access code
        // Check if IP permission record exists for this user
        const existingIpResult = await sequelize.query(
          ipAccessQueries.getIpPermissionByUserId,
          {
            replacements: { userId: user.UserID },
            type: sequelize.QueryTypes.SELECT,
            raw: true,
          },
        );

        const newAccessCode = generateAccessCode();
        const emailToSend = user.Case_Tracking_Email || user.EmailAddr;

        if (!existingIpResult || existingIpResult.length === 0) {
          // Create new IP permission record
          await sequelize.query(ipAccessQueries.insertIpPermission, {
            replacements: {
              ipAddress,
              username: user.UserLogin,
              userId: user.UserID,
              accessCode: newAccessCode,
            },
            type: sequelize.QueryTypes.INSERT,
          });
        } else {
          // Update existing record with new access code
          await sequelize.query(
            ipAccessQueries.updateIpPermissionSetAccessCode,
            {
              replacements: {
                userId: user.UserID,
                accessCode: newAccessCode,
              },
              type: sequelize.QueryTypes.UPDATE,
            },
          );
        }

        // Send access code email
        await sendAccessCodeEmail(emailToSend, newAccessCode);

        // Mask email for security
        const maskedEmail = emailToSend.replace(/(.{2})(.*)(@.+)/, "$1***$3");

        return res.status(200).json({
          status: "access_code_required",
          message: "We have sent an access code to your email",
          data: {
            email: maskedEmail,
          },
        });
      }
    }

    // IP is approved or access code verified - proceed with login
    // Generate session token
    const sessionToken = crypto.randomUUID();

    // Check if session exists
    const sessionExistsResult = await sequelize.query(
      adminSessionQueries.checkSessionExists,
      {
        replacements: { username: user.UserLogin },
        type: sequelize.QueryTypes.SELECT,
        raw: true,
      },
    );

    if (sessionExistsResult && sessionExistsResult.length > 0) {
      // Update existing session
      await sequelize.query(adminSessionQueries.updateAdminSession, {
        replacements: {
          token: sessionToken,
          username: user.UserLogin,
        },
        type: sequelize.QueryTypes.UPDATE,
      });
    } else {
      // Insert new session
      const userDisplayName =
        `${user.Title || ""} ${user.UserFName || ""} ${user.UserLName || ""}`.trim();

      await sequelize.query(adminSessionQueries.insertAdminSession, {
        replacements: {
          userId: user.UserID,
          userTypeId: user.UserTypeID,
          userFName: user.UserFName || "",
          username: user.UserLogin,
          university: user.University || "",
          userDisplayName,
          customerDisplayName: user.Customer_Display_Name || "",
          userTypeDisplayName: user.User_Type_Display_Name || "",
          email: user.EmailAddr || "",
          customerId: user.CustId || 0,
          customerAccountNumber: user.Customer_Account_Number || 0,
          token: sessionToken,
        },
        type: sequelize.QueryTypes.INSERT,
      });
    }

    // Generate JWT token
    const jwtToken = generateToken({
      UserId: user.UserID,
      UserLogin: user.UserLogin,
      UserName: user.UserName,
      AdminToken: sessionToken,
    });

    // Return success response
    return res.status(200).json({
      status: "success",
      data: {
        token: jwtToken,
        adminToken: sessionToken,
        user: {
          UserId: user.UserID,
          UserLogin: user.UserLogin,
          UserName: user.UserName,
          UserFName: user.UserFName,
          UserLName: user.UserLName,
          UserTypeID: user.UserTypeID,
          CustomerID: user.CustomerID,
          Customer_Display_Name: user.Customer_Display_Name,
          User_Type_Display_Name: user.User_Type_Display_Name,
        },
      },
    });
  } catch (error) {
    console.error("Login endpoint error:", error);
    return res.status(500).json({
      status: "error",
      message: "An error occurred during authentication",
    });
  }
});

/**
 * POST /auth/logout
 *
 * Logout endpoint. Currently a placeholder as JWT tokens are stateless.
 * Future: Can be extended for token blacklisting if needed.
 *
 * Response (200):
 * {
 *   "status": "success",
 *   "message": "Logged out successfully"
 * }
 */
router.post("/logout", (req, res) => {
  // JWT is stateless, so logout is handled on the client by removing the token
  // This endpoint exists for future extensibility (token blacklisting, etc.)
  return res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
});

module.exports = router;
