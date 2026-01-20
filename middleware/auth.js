/**
 * JWT Middleware (Optional)
 *
 * Middleware for protecting routes that require authentication.
 * Validates JWT tokens and extracts user information.
 *
 * Usage: app.use("/api/protected", verifyToken, routes);
 */

const {
  verifyToken: verify,
  extractTokenFromHeader,
} = require("../utils/authUtils");

/**
 * Verify JWT token middleware
 *
 * Extracts and validates JWT from Authorization header.
 * Stores decoded user info in req.user for downstream handlers.
 *
 * Header format: Authorization: Bearer <token>
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        status: "error",
        message: "Missing authorization header",
      });
    }

    // Extract token from "Bearer <token>"
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Invalid authorization header format. Expected: Bearer <token>",
      });
    }

    // Verify and decode token
    const decoded = verify(token);
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        message: "Invalid token",
      });
    }

    console.error("Token verification error:", error);
    return res.status(500).json({
      status: "error",
      message: "Token verification failed",
    });
  }
}

module.exports = { verifyToken };
