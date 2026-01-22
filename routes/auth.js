/**
 * Authentication Routes
 *
 * Handles user authentication endpoints:
 * - POST /auth/login - Username/password authentication
 * - POST /auth/logout - Session cleanup (if needed)
 *
 * Returns JWT tokens for authenticated users.
 */

const express = require("express");
const { hashPassword } = require("../utils/md5Hash");
const { verifyUserCredentials } = require("../models/User");
const { generateToken } = require("../utils/authUtils");

const router = express.Router();

/**
 * POST /auth/login
 *
 * Authenticates user with username and password.
 *
 * Request body:
 * {
 *   "username": "string",
 *   "password": "string"
 * }
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": {
 *     "token": "JWT token",
 *     "user": {
 *       "UserId": number,
 *       "UserLogin": "string"
 *     }
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
    const { username, password } = req.body;

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

    if (trimmedUsername.length === 0 || trimmedPassword.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Username and password cannot be empty",
      });
    }

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

    // Verify credentials against database
    const user = await verifyUserCredentials(trimmedUsername, passwordHash);

    if (!user) {
      // Don't specify whether username or password is wrong (security best practice)
      return res.status(401).json({
        status: "error",
        message: "Invalid username or password",
      });
    }

    // Generate JWT token
    const token = generateToken({
      UserId: user.UserId,
      UserLogin: user.UserLogin,
      UserName: user.UserName
    });

    // Return success response
    return res.status(200).json({
      status: "success",
      data: {
        token,
        user: {
          UserId: user.UserId,
          UserLogin: user.UserLogin,
          UserName: user.UserName
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
