/**
 * Shopify Routes
 *
 * Handles Shopify case processing endpoints:
 * - POST /shopify/process-case - Process a single case ID (database check)
 * - POST /shopify/fetch-order - Fetch order from Shopify GraphQL using order ID
 * - GET /shopify/case-status/:caseId - Get case status from database
 *
 * All endpoints require authentication via JWT token.
 */

const express = require("express");
const { sequelize } = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const { fetchOrderByNumber } = require("../utils/shopifyClient");

const router = express.Router();

/**
 * POST /shopify/process-case
 *
 * Processes a single case ID.
 * Checks if case exists in database, fetches order data from Shopify if new.
 *
 * Request body:
 * {
 *   "caseId": "string (numeric)"
 * }
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": {
 *     "caseId": "string",
 *     "exists": boolean,
 *     "caseData": {
 *       "Case_ID": number,
 *       "Case_Patient_First_Name": "string",
 *       "Case_Date_Received": "YYYY-MM-DD",
 *       ... other case fields
 *     } or null if new case
 *   }
 * }
 *
 * Response on error (400/500):
 * {
 *   "status": "error",
 *   "message": "Error message"
 * }
 */
router.post("/process-case", verifyToken, async (req, res) => {
  try {
    const { caseId } = req.body;

    // Validate input
    if (!caseId) {
      return res.status(400).json({
        status: "error",
        message: "Case ID is required",
      });
    }

    // Ensure caseId is numeric
    if (!/^\d+$/.test(caseId)) {
      return res.status(400).json({
        status: "error",
        message: "Case ID must contain numerals only",
      });
    }

    // Query to check if case exists in database
    const query = `
        SELECT TOP 1
            c.Case_ID,
            c.Case_Patient_First_Name,
            c.Case_Date_Received,
            c.IsRushOrder,
            s.Status_Streamline_Options
        FROM dbo.[Case] c
        LEFT JOIN dbo.Status s ON c.Case_Status_Code = s.Status_ID
        WHERE c.Case_ID = :caseId
    `;

    const result = await sequelize.query(query, {
      replacements: { caseId: parseInt(caseId) },
      type: sequelize.QueryTypes.SELECT,
      raw: true,
    });

    const caseExists = result && result.length > 0;

    res.status(200).json({
      status: "success",
      data: {
        caseId,
        exists: caseExists,
        caseData: caseExists ? result[0] : null,
        // Prepare for Shopify GraphQL integration when case doesn't exist
        shopifyRequired: !caseExists,
      },
    });
  } catch (error) {
    console.error("Error processing case:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to process case",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
});

/**
 * GET /shopify/case-status/:caseId
 *
 * Retrieves the current status of a case from database.
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": {
 *     "caseId": number,
 *     "exists": boolean,
 *     "caseDetails": { ... } or null
 *   }
 * }
 *
 * Response on error (500):
 * {
 *   "status": "error",
 *   "message": "Error message"
 * }
 */
router.get("/case-status/:caseId", verifyToken, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Validate input
    if (!caseId || !/^\d+$/.test(caseId)) {
      return res.status(400).json({
        status: "error",
        message: "Valid numeric Case ID is required",
      });
    }

    const query = `
      SELECT TOP 1
        c.Case_ID,
        c.Case_Patient_First_Name,
        c.Case_Date_Received,
        c.IsRushOrder,
        c.Case_Status_ID,
        s.Status_Streamline_Options
      FROM dbo.[Case] c
      LEFT JOIN dbo.Status s ON c.Case_Status_ID = s.Status_ID
      WHERE c.Case_ID = @caseId
    `;

    const result = await sequelize.query(query, {
      replacements: { caseId: parseInt(caseId) },
      type: sequelize.QueryTypes.SELECT,
      raw: true,
    });

    const caseExists = result && result.length > 0;

    res.status(200).json({
      status: "success",
      data: {
        caseId: parseInt(caseId),
        exists: caseExists,
        caseDetails: caseExists ? result[0] : null,
      },
    });
  } catch (error) {
    console.error("Error fetching case status:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch case status",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
});

/**
 * POST /shopify/fetch-order
 *
 * Fetches order data from Shopify GraphQL API using order ID.
 * Implements automatic rate limiting to respect Shopify API limits.
 *
 * Request body:
 * {
 *   "orderId": "string (numeric)"
 * }
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": {
 *     "orderId": "string",
 *     "orderData": {
 *       "id": "gid://shopify/Order/...",
 *       "name": "#1001",
 *       "orderNumber": 1001,
 *       "email": "customer@example.com",
 *       "customer": { ... },
 *       "lineItems": [ ... ],
 *       "totalPriceSet": { ... },
 *       ... other Shopify order fields
 *     }
 *   }
 * }
 *
 * Response on error (400/500):
 * {
 *   "status": "error",
 *   "message": "Error message",
 *   "code": "error_code"
 * }
 *
 * Error codes:
 * - ORDER_NOT_FOUND: Order doesn't exist in Shopify
 * - SHOPIFY_API_ERROR: Issue with Shopify API communication
 * - INVALID_ORDER_ID: Invalid order ID format
 * - MISSING_CREDENTIALS: Shopify credentials not configured
 */
router.post("/fetch-order", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.body;

    // Validate input
    if (!orderId) {
      return res.status(400).json({
        status: "error",
        message: "Order ID is required",
        code: "MISSING_ORDER_ID",
      });
    }

    // Ensure orderId is numeric
    if (!/^\d+$/.test(orderId)) {
      return res.status(400).json({
        status: "error",
        message: "Order ID must contain numerals only",
        code: "INVALID_ORDER_ID",
      });
    }

    console.log(`Fetching order ${orderId} from Shopify...`);

    // Fetch order from Shopify GraphQL API
    const orderData = await fetchOrderByNumber(orderId);

    console.log(`Successfully fetched order ${orderId} from Shopify`);

    res.status(200).json({
      status: "success",
      data: {
        orderId,
        orderData,
      },
    });
  } catch (error) {
    console.error("Error fetching Shopify order:", error);

    // Determine error code and appropriate response
    let statusCode = 500;
    let errorCode = "SHOPIFY_API_ERROR";

    if (error.message.includes("not found")) {
      statusCode = 404;
      errorCode = "ORDER_NOT_FOUND";
    } else if (error.message.includes("Missing Shopify credentials")) {
      statusCode = 500;
      errorCode = "MISSING_CREDENTIALS";
    } else if (error.message.includes("GraphQL Error")) {
      statusCode = 400;
      errorCode = "SHOPIFY_API_ERROR";
    }

    res.status(statusCode).json({
      status: "error",
      message: error.message || "Failed to fetch order from Shopify",
      code: errorCode,
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
});

module.exports = router;
