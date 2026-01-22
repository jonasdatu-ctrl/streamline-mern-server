/**
 * Main routes file.
 * Centralizes all API routes for the application.
 */

const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./auth");
const reportRoutes = require("./reports");
const casesRoutes = require("./receivecases");
const shopifyRoutes = require("./shopify");
const statusRoutes = require("./status");

// Mount route modules
router.use("/auth", authRoutes);
router.use("/reports", reportRoutes);
router.use("/cases", casesRoutes);
router.use("/shopify", shopifyRoutes);
router.use("/status", statusRoutes);

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
      cases: {
        processCase: "POST /cases/process-case",
        getCase: "GET /cases/get-case/:caseId",
      },
      shopify: {
        fetchOrder: "POST /shopify/fetch-order",
      },
      status: {
        getStatus: "GET /status/statuses/:statusId",
        getAllStatuses: "GET /status/statuses",
      },
    },
  });
});

module.exports = router;
