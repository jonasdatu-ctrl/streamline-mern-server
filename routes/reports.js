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
    const query = `
      SELECT        
        a.Case_ID, 
        b.Case_Patient_First_Name AS FirstName, 
        LastScanStatus = c.Status_Streamline_Options + '-' + a.TRN_STATUS_CODE, 
        f.Name AS StatusGroup, 
        Cast(b.Case_Date_Received AS DATE) AS DateReceived, 
        DaysInLab = DATEDIFF(DAY, b.Case_Date_Received, GETDATE()), 
        LastScanDate = Cast(a.Case_Date_Record_Created AS DATE), 
        a.TRN_SHIP_REF_NUM, 
        b.IsRushOrder AS Rush, 
        a.TRN_STATUS_CODE, 
        b.ShipCarrierId
      FROM            
        (
          SELECT        
            ROW_NUMBER() OVER (PARTITION BY case_Id ORDER BY Case_Date_Record_Created DESC) AS RowNumber, 
            case_id, 
            TRN_STATUS_CODE, 
            Case_Date_Record_Created, 
            TRN_SHIP_REF_NUM
          FROM casetransaction
          WHERE Case_ID NOT IN
            (SELECT CaseId FROM dbo.YearEndClosedCases)
        ) a 
      INNER JOIN dbo.[Case] b ON a.Case_ID = b.Case_ID 
      INNER JOIN dbo.Status c ON a.TRN_STATUS_CODE = c.Status_ID 
      INNER JOIN dbo.StatusGroup f ON c.StatusGroupId = f.StatusGroupId
      WHERE        
        a.RowNumber = 1 
        AND f.StatusGroupID NOT IN (3, 13, 14, 15, 29, 30) 
        AND b.Case_Lab_ID IN (52, 53)
      ORDER BY b.Case_Date_Received DESC
    `;

    const result = await sequelize.query(query, {
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
