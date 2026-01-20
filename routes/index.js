/**
 * Main routes file.
 * Centralizes all API routes for the application.
 */

const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./auth");
const reportRoutes = require("./reports");

// Mount route modules
router.use("/auth", authRoutes);
router.use("/reports", reportRoutes);

// Placeholder route for initial setup
router.get("/", (req, res) => {
  res.json({
    message: "Welcome to Streamline Shopify API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: {
        login: "POST /auth/login",
        logout: "POST /auth/logout",
      },
      reports: {
        poponBacklog: "GET /reports/popon-backlog",
      },
      // Add more endpoints as they are implemented
    },
  });
});

module.exports = router;
