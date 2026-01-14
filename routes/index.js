/**
 * Main routes file.
 * Centralizes all API routes for the application.
 */

const express = require("express");
const router = express.Router();

// Import route modules (add more as needed)
const userRoutes = require("./users");
// const authRoutes = require('./auth');
// const caseRoutes = require('./cases');

// Mount routes
router.use("/users", userRoutes);
// router.use('/auth', authRoutes);
// router.use('/cases', caseRoutes);

// Placeholder route for initial setup
router.get("/", (req, res) => {
  res.json({
    message: "Welcome to Streamline Shopify API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      users: "/api/users",
      // Add more endpoints as they are implemented
    },
  });
});

module.exports = router;
