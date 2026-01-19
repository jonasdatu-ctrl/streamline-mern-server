/**
 * Main routes file.
 * Centralizes all API routes for the application.
 */

const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./auth");

// Mount route modules
router.use("/auth", authRoutes);

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
      // Add more endpoints as they are implemented
    },
  });
});

module.exports = router;
