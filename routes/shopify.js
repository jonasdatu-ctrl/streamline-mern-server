/**
 * Shopify Routes
 *
 * Handles Shopify case processing endpoints:
 * - POST /shopify/process-case - Process a single case ID
 * - GET /shopify/case-status/:caseId - Get case status from database
 *
 * All endpoints require authentication via JWT token.
 */

const express = require("express");
const { sequelize } = require("../config/database");
const { verifyToken } = require("../middleware/auth");

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

module.exports = router;
