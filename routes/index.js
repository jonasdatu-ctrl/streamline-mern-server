/**
 * Main routes file.
 * Centralizes all API routes for the application.
 */

const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./auth");
const reportRoutes = require("./reports");
const shopifyRoutes = require("./shopify");

// Mount route modules
router.use("/auth", authRoutes);
router.use("/reports", reportRoutes);
router.use("/shopify", shopifyRoutes);

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
      shopify: {
        processCase: "POST /shopify/process-case",
        caseStatus: "GET /shopify/case-status/:caseId",
      },
    },
  });
});

module.exports = router;
