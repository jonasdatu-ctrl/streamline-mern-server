/**
 * Authentication Utilities
 *
 * Provides modular authentication-related functions for easy reuse
 * across the application.
 */

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";

/**
 * Generate JWT token for authenticated user
 * @param {Object} payload - Data to encode in token (user ID, username, etc.)
 * @returns {string} JWT token
 * @throws {Error} If JWT_SECRET is not configured
 */
const generateToken = (payload) => {
  if (!JWT_SECRET) {
    throw new Error("Missing JWT_SECRET environment variable");
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token) => {
  if (!JWT_SECRET) {
    throw new Error("Missing JWT_SECRET environment variable");
  }

  return jwt.verify(token, JWT_SECRET);
};

/**
 * Extract token from Authorization header
 * Expected format: "Bearer <token>"
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if format is invalid
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  JWT_SECRET,
  JWT_EXPIRY,
};
