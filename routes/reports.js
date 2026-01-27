/**
 * Reports Routes
 *
 * Handles all reporting endpoints:
 * - GET /reports/popon-backlog - PopOn backlog report with active cases
 *
 * All endpoints require authentication via JWT token.
 */

const express = require("express");
const { sequelize } = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const { reportQueries } = require("../config/queries");

const router = express.Router();

/**
 * GET /reports/popon-backlog
 *
 * Returns the PopOn backlog report showing active cases pending processing and shipment.
 *
 * Query Details:
 * - Retrieves latest transaction status for each case
 * - Filters out year-end closed cases
 * - Filters for specific lab IDs (52, 53)
 * - Excludes certain status groups (3, 13, 14, 15, 29, 30)
 * - Includes patient info, status history, and shipping reference
 *
 * Response on success (200):
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "Case_ID": number,
 *       "FirstName": "string",
 *       "LastScanStatus": "string",
 *       "StatusGroup": "string",
 *       "DateReceived": "YYYY-MM-DD",
 *       "DaysInLab": number,
 *       "LastScanDate": "YYYY-MM-DD",
 *       "TRN_SHIP_REF_NUM": "string",
 *       "Rush": boolean,
 *       "TRN_STATUS_CODE": string,
 *       "ShipCarrierId": number
 *     }
 *   ],
 *   "count": number
 * }
 *
 * Response on error (500):
 * {
 *   "status": "error",
 *   "message": "Error message"
 * }
 */
router.get("/popon-backlog", verifyToken, async (req, res) => {
  try {
    const result = await sequelize.query(reportQueries.getPopOnBacklogReport, {
      type: sequelize.QueryTypes.SELECT,
      raw: true,
    });

    res.status(200).json({
      status: "success",
      data: result || [],
      count: (result || []).length,
    });
  } catch (error) {
    console.error("Error fetching PopOn backlog report:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch PopOn backlog report",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
});

module.exports = router;
