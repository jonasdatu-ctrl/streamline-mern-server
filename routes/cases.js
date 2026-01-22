/**
 * Cases Routes
 *
 * Handles case management endpoints:
 * - POST /cases/receive-case - Receive a single case ID (database check)
 * - GET /cases/get-case/:caseId - Get case information from database
 *
 * All endpoints require authentication via JWT token.
 */

const express = require("express");
const { sequelize } = require("../config/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Constants
const NUMERIC_PATTERN = /^\d+$/;
const ERROR_CODES = {
  MISSING_CASE_ID: "MISSING_CASE_ID",
  INVALID_CASE_ID: "INVALID_CASE_ID",
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
 * POST /cases/receive-case
 *
 * Receives and processes a single case ID.
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
router.post("/receive-case", verifyToken, async (req, res) => {
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
    console.error("Error receiving case:", error);
    const { statusCode, data } = formatErrorResponse("Failed to receive case");
    res.status(statusCode).json(data);
  }
});

/**
 * GET /cases/get-case/:caseId
 *
 * Retrieves case information from database.
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": {
 *     "caseId": number,
 *     "exists": boolean,
 *     "caseInfo": {
 *       "Case_ID": number,
 *       "Case_Patient_First_Name": "string",
 *       "Case_Date_Received": "YYYY-MM-DD",
 *       "IsRushOrder": boolean,
 *       "Case_Status_ID": number,
 *       "Status_Streamline_Options": "string"
 *     } or null if not found
 *   }
 * }
 */
router.get("/get-case/:caseId", verifyToken, async (req, res) => {
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
        caseInfo: caseExists ? result[0] : null,
      },
    });
  } catch (error) {
    console.error("Error fetching case information:", error);
    const { statusCode, data } = formatErrorResponse("Failed to fetch case information");
    res.status(statusCode).json(data);
  }
});

module.exports = router;
