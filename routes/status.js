/**
 * Status Routes
 *
 * Handles status information endpoints:
 * - GET /status/statuses - Get all available statuses
 * - GET /status/statuses/:statusId - Get specific status by ID
 *
 * All endpoints require authentication via JWT token.
 */

const express = require("express");
const { sequelize } = require("../config/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

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
 * GET /status/statuses
 *
 * Retrieves all available case statuses from the Status table.
 * Used for populating status dropdowns and filtering.
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": {
 *     "statuses": [
 *       {
 *         "Status_ID": number,
 *         "Status_Streamline_Options": "string"
 *       },
 *       ...
 *     ]
 *   }
 * }
 */
router.get("/statuses", verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        Status_ID,
        Status_Streamline_Options
      FROM dbo.Status
      ORDER BY Status_ID ASC
    `;

    const result = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      raw: true,
    });

    res.status(200).json({
      status: "success",
      data: {
        statuses: result || [],
      },
    });
  } catch (error) {
    console.error("Error fetching statuses:", error);
    const { statusCode, data } = formatErrorResponse("Failed to fetch statuses");
    res.status(statusCode).json(data);
  }
});

/**
 * GET /status/statuses/:statusId
 *
 * Retrieves a specific status by ID.
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": {
 *     "statusId": number,
 *     "statusInfo": {
 *       "Status_ID": number,
 *       "Status_Streamline_Options": "string"
 *     } or null if not found
 *   }
 * }
 */
router.get("/statuses/:statusId", verifyToken, async (req, res) => {
  try {
    const { statusId } = req.params;

    // Validate statusId is numeric
    if (!statusId || !/^\d+$/.test(statusId)) {
      return res.status(400).json({
        status: "error",
        message: "Status ID must be a valid number",
        code: "INVALID_STATUS_ID",
      });
    }

    const query = `
      SELECT 
        Status_ID,
        Status_Streamline_Options
      FROM dbo.Status
      WHERE Status_ID = :statusId
    `;

    const result = await sequelize.query(query, {
      replacements: { statusId: parseInt(statusId, 10) },
      type: sequelize.QueryTypes.SELECT,
      raw: true,
    });

    const statusInfo = result && result.length > 0 ? result[0] : null;

    res.status(200).json({
      status: "success",
      data: {
        statusId: parseInt(statusId, 10),
        statusInfo,
      },
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    const { statusCode, data } = formatErrorResponse("Failed to fetch status");
    res.status(statusCode).json(data);
  }
});

module.exports = router;
