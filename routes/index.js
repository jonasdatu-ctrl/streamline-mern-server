/**
 * Main routes file.
 * Centralizes all API routes for the application.
 */

const express = require("express");
const router = express.Router();

// Placeholder route for initial setup
router.get("/", (req, res) => {
  res.json({
    message: "Welcome to Streamline Shopify API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      // Add more endpoints as they are implemented
    },
  });
});

module.exports = router;
