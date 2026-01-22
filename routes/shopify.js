/**
 * Shopify Routes
 *
 * Handles Shopify integration endpoints:
 * - POST /shopify/fetch-order - Fetch order from Shopify GraphQL using order ID
 *
 * All endpoints require authentication via JWT token.
 */

const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { fetchOrderByNumber } = require("../utils/shopifyClient");

const router = express.Router();

// Constants
const NUMERIC_PATTERN = /^\d+$/;
const ERROR_CODES = {
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
const formatErrorResponse = (
  message,
  code = "INTERNAL_ERROR",
  statusCode = 500,
) => {
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
 * Response on error (400/404/500):
 * {
 *   "status": "error",
 *   "message": "Error description",
 *   "code": "ERROR_CODE"
 * }
 *
 * Error codes:
 * - MISSING_ORDER_ID: Order ID not provided
 * - INVALID_ORDER_ID: Order ID contains non-numeric characters
 * - ORDER_NOT_FOUND: Order doesn't exist in Shopify
 * - SHOPIFY_API_ERROR: Issue with Shopify API communication
 * - MISSING_CREDENTIALS: Shopify credentials not configured
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
