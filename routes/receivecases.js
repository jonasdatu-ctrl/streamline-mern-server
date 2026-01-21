/**
 * Receive Cases Routes
 *
 * Handles case processing endpoints:
 * - POST /cases/process-case - Process a single case ID (database check)
 * - POST /cases/fetch-order - Fetch order from Shopify GraphQL using order ID
 * - GET /cases/case-status/:caseId - Get case status from database
 *
 * All endpoints require authentication via JWT token.
 */

const express = require("express");
const { sequelize } = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const { fetchOrderByNumber } = require("../utils/shopifyClient");

const router = express.Router();

// Constants
const NUMERIC_PATTERN = /^\d+$/;
const ERROR_CODES = {
  MISSING_CASE_ID: "MISSING_CASE_ID",
  INVALID_CASE_ID: "INVALID_CASE_ID",
  MISSING_ORDER_ID: "MISSING_ORDER_ID",
  INVALID_ORDER_ID: "INVALID_ORDER_ID",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  SHOPIFY_API_ERROR: "SHOPIFY_API_ERROR",
  MISSING_CREDENTIALS: "MISSING_CREDENTIALS",
};

/**
 * Helper: Validate numeric ID input
 */
const validateNumericId = (id, fieldName) => {
  if (!id) {
    return {
      valid: false,
      message: `${fieldName} is required`,
      code: `MISSING_${fieldName.toUpperCase().replace(/\s+/g, "_")}`,
    };
  }
  if (!NUMERIC_PATTERN.test(id)) {
    return {
      valid: false,
      message: `${fieldName} must contain numerals only`,
      code: `INVALID_${fieldName.toUpperCase().replace(/\s+/g, "_")}`,
    };
  }
  return { valid: true };
};

/**
 * Helper: Format error response
 */
const formatErrorResponse = (message, code = "INTERNAL_ERROR", statusCode = 500) => {
  const response = {
    status: "error",
    message,
    code,
  };
  if (process.env.NODE_ENV === "development") {
    response.details = message;
  }
  return { statusCode, data: response };
};

/**
 * POST /cases/process-case
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
 */
router.post("/process-case", verifyToken, async (req, res) => {
  try {
    const { caseId } = req.body;

    // Validate input
    const validation = validateNumericId(caseId, "Case ID");
    if (!validation.valid) {
      return res.status(400).json({
        status: "error",
        message: validation.message,
        code: validation.code,
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
      replacements: { caseId: parseInt(caseId, 10) },
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
        shopifyRequired: !caseExists,
      },
    });
  } catch (error) {
    console.error("Error processing case:", error);
    const { statusCode, data } = formatErrorResponse("Failed to process case");
    res.status(statusCode).json(data);
  }
});

/**
 * GET /cases/case-status/:caseId
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
 */
router.get("/case-status/:caseId", verifyToken, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Validate input
    const validation = validateNumericId(caseId, "Case ID");
    if (!validation.valid) {
      return res.status(400).json({
        status: "error",
        message: validation.message,
        code: validation.code,
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
      WHERE c.Case_ID = :caseId
    `;

    const result = await sequelize.query(query, {
      replacements: { caseId: parseInt(caseId, 10) },
      type: sequelize.QueryTypes.SELECT,
      raw: true,
    });

    const caseExists = result && result.length > 0;

    res.status(200).json({
      status: "success",
      data: {
        caseId: parseInt(caseId, 10),
        exists: caseExists,
        caseDetails: caseExists ? result[0] : null,
      },
    });
  } catch (error) {
    console.error("Error fetching case status:", error);
    const { statusCode, data } = formatErrorResponse("Failed to fetch case status");
    res.status(statusCode).json(data);
  }
});

/**
 * POST /cases/fetch-order
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
 */
router.post("/fetch-order", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.body;

    // Validate input
    const validation = validateNumericId(orderId, "Order ID");
    if (!validation.valid) {
      return res.status(400).json({
        status: "error",
        message: validation.message,
        code: validation.code,
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
    let errorCode = ERROR_CODES.SHOPIFY_API_ERROR;

    if (error.message.includes("not found")) {
      statusCode = 404;
      errorCode = ERROR_CODES.ORDER_NOT_FOUND;
    } else if (error.message.includes("Missing Shopify credentials")) {
      statusCode = 500;
      errorCode = ERROR_CODES.MISSING_CREDENTIALS;
    } else if (error.message.includes("GraphQL Error")) {
      statusCode = 400;
      errorCode = ERROR_CODES.SHOPIFY_API_ERROR;
    }

    res.status(statusCode).json({
      status: "error",
      message: error.message || "Failed to fetch order from Shopify",
      code: errorCode,
      ...(process.env.NODE_ENV === "development" && { details: error.message }),
    });
  }
});

module.exports = router;
