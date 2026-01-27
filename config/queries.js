/**
 * SQL Queries Module
 *
 * Centralized location for all SQL queries used throughout the application.
 * This makes queries easy to find, edit, and maintain in one place.
 *
 * Organization:
 * - User queries
 * - Status queries
 * - Case queries
 * - Report queries
 */

// =============================================================================
// USER QUERIES
// =============================================================================

const userQueries = {
  /**
   * Find a user by username for authentication
   */
  getUserByUsername: `
    SELECT TOP 1 
      UserID, 
      UserLogin, 
      UserName, 
      [Password] 
    FROM dbo.[User] 
    WHERE UserLogin = :username
  `,

  /**
   * Get user with full details for login including customer info
   */
  getUserWithDetails: `
    SELECT TOP 1 
      u.UserID,
      u.UserTypeID,
      u.UserName,
      u.UserLogin,
      u.Title,
      u.UserFName,
      u.UserLName,
      u.UserMName,
      u.[Password],
      u.RANDOM_PASSWORD,
      u.EmailAddr,
      u.Case_Tracking_Email,
      u.University,
      u.CustomerID,
      ut.User_Type_Display_Name,
      c.Customer_Display_Name,
      c.CustomerId as CustId,
      c.Customer_Account_Number
    FROM [dbo].[User] u
    INNER JOIN dbo.UserType ut ON ut.UserTypeId = u.UserTypeId
    LEFT OUTER JOIN dbo.Customer c ON (c.customerId = u.CustomerID OR c.Name = u.University)
    WHERE (u.UserName = :username OR u.UserLogin = :username)
      AND u.Password = :password
  `,
};

// =============================================================================
// STATUS QUERIES
// =============================================================================

const statusQueries = {
  /**
   * Get all available statuses ordered by ID
   */
  getAllStatuses: `
    SELECT 
      Status_ID,
      Status_Streamline_Options
    FROM dbo.Status
    ORDER BY Status_ID ASC
  `,

  /**
   * Get a specific status by ID
   */
  getStatusById: `
    SELECT 
      Status_ID,
      Status_Streamline_Options
    FROM dbo.Status
    WHERE Status_ID = :statusId
  `,
};

// =============================================================================
// CASE QUERIES
// =============================================================================

const caseQueries = {
  /**
   * Check if a case exists and get basic information with status
   */
  getCaseWithStatus: `
    SELECT TOP 1
      c.Case_ID,
      c.Case_Patient_First_Name,
      c.Case_Date_Received,
      c.IsRushOrder,
      s.Status_Streamline_Options
    FROM dbo.[Case] c
    LEFT JOIN dbo.Status s ON c.Case_Status_Code = s.Status_ID
    WHERE c.Case_ID = :caseId
  `,

  /**
   * Get detailed case information including status
   */
  getCaseById: `
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
  `,

  /**
   * Check if a case ID already exists
   */
  checkCaseExists: `
    SELECT TOP 1 Case_ID 
    FROM dbo.[Case] 
    WHERE Case_ID = :caseId
  `,

  /**
   * Insert a new case record
   */
  insertCase: `
    INSERT INTO dbo.[Case] (
      Case_ID,
      UserID,
      Case_Customer_ID,
      Case_Date_Received,
      Case_Date_Required_By_DR,
      Case_Patient_First_Name,
      Case_Patient_Last_Name,
      Case_Patient_Num,
      Shopify_Email,
      CaseRXInstructions,
      case_status_code,
      Case_Lab_ID,
      Case_STR_Invoice_Date,
      Case_Date_Estimated_Return,
      ShipToId,
      Case_Lab_Invoice_Fee,
      Case_Clinic_PO_Number,
      ShipCarrierId,
      Invoice_Approved_For_Payment,
      DoctorReviewed,
      IsRushOrder
    ) VALUES (
      :caseId,
      :userId,
      :customerId,
      GETDATE(),
      DATEADD(day, :daysRequired, GETDATE()),
      :firstName,
      :lastName,
      :orderNumber,
      :email,
      :instructions,
      :statusCode,
      :labId,
      GETDATE(),
      DATEADD(day, 14, GETDATE()),
      :shipToId,
      :invoiceFee,
      :poNumber,
      :carrierId,
      'N',
      'Y',
      :isRush
    )
  `,

  /**
   * Insert a new case transaction record
   */
  insertCaseTransaction: `
    INSERT INTO dbo.CaseTransaction (
      Case_ID,
      TRN_EMPLOYEE_ID,
      UserId,
      TRN_STATUS_CODE,
      TRN_SHIP_REF_NUM,
      Case_Date_Record_Created,
      TRN_SHIP_COMPANY,
      ShipCarrierId
    ) VALUES (
      :caseId,
      :employeeId,
      :userId,
      :statusCode,
      NULL,
      GETDATE(),
      NULL,
      :carrierId
    )
  `,
};

// =============================================================================
// REPORT QUERIES
// =============================================================================

const reportQueries = {
  /**
   * PopOn Backlog Report
   * Shows active cases pending processing and shipment
   * - Filters out year-end closed cases
   * - Filters for specific lab IDs (52, 53)
   * - Excludes certain status groups (3, 13, 14, 15, 29, 30)
   */
  getPopOnBacklogReport: `
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
  `,
};

// =============================================================================
// IP ADDRESS & ACCESS CODE QUERIES
// =============================================================================

const ipAccessQueries = {
  /**
   * Check if IP address is approved for login (has entry with empty AccessCode)
   */
  checkIpApproved: `
    SELECT TOP 1 
      IPAddress, 
      UserID, 
      AccessCode
    FROM dbo.IPAddress_AdminPermission
    WHERE IPAddress = :ipAddress AND AccessCode = ''
  `,

  /**
   * Get IP permission record by UserID
   */
  getIpPermissionByUserId: `
    SELECT TOP 1 
      IPAddress, 
      UserID, 
      AccessCode
    FROM dbo.IPAddress_AdminPermission
    WHERE UserID = :userId
  `,

  /**
   * Verify access code for user
   */
  verifyAccessCode: `
    SELECT TOP 1 
      IPAddress, 
      UserID, 
      AccessCode
    FROM dbo.IPAddress_AdminPermission
    WHERE AccessCode = :accessCode
  `,

  /**
   * Insert new IP permission record with access code
   */
  insertIpPermission: `
    INSERT INTO dbo.IPAddress_AdminPermission (
      IPAddress, 
      [Name], 
      UserID, 
      AccessCode
    ) VALUES (
      :ipAddress, 
      :username, 
      :userId, 
      :accessCode
    )
  `,

  /**
   * Update IP permission - clear access code and update IP address
   */
  updateIpPermissionAfterVerification: `
    UPDATE dbo.IPAddress_AdminPermission
    SET IPAddress = :ipAddress, 
        AccessCode = ''
    WHERE AccessCode = :accessCode
  `,

  /**
   * Update IP permission - set new access code and clear IP
   */
  updateIpPermissionSetAccessCode: `
    UPDATE dbo.IPAddress_AdminPermission
    SET AccessCode = :accessCode, 
        IPAddress = ''
    WHERE UserID = :userId
  `,
};

// =============================================================================
// ADMIN SESSION QUERIES
// =============================================================================

const adminSessionQueries = {
  /**
   * Check if admin session exists for username
   */
  checkSessionExists: `
    SELECT TOP 1 
      username, 
      Token, 
      SessionStart
    FROM dbo.AdminSessionData
    WHERE UserId = :userID
  `,

  /**
   * Insert new admin session
   */
  insertAdminSession: `
    INSERT INTO dbo.AdminSessionData (
      UserId,
      UserTypeId,
      UserFName,
      username,
      University,
      UserDisplayName,
      CustomerDisplayName,
      UserTypeDisplayName,
      UserEmail,
      CustomerId,
      CustomerAccountNumber,
      Token,
      SessionStart
    ) VALUES (
      :userId,
      :userTypeId,
      :userFName,
      :username,
      :university,
      :userDisplayName,
      :customerDisplayName,
      :userTypeDisplayName,
      :email,
      :customerId,
      :customerAccountNumber,
      :token,
      GETDATE()
    )
  `,

  /**
   * Update existing admin session with new token
   */
  updateAdminSession: `
    UPDATE dbo.AdminSessionData
    SET Token = :token, 
        SessionStart = GETDATE()
    WHERE username = :username
  `,

  /**
   * Get session token for username
   */
  getSessionToken: `
    SELECT TOP 1 Token
    FROM dbo.AdminSessionData
    WHERE username = :username
  `,
};

// =============================================================================
// LOGGING QUERIES
// =============================================================================

const loggingQueries = {
  /**
   * Log failed login attempt
   */
  logFailedLoginAttempt: `
    INSERT INTO dbo.Log_FailedLoginAttempt (
      UserName, 
      Password, 
      DateCreated
    ) VALUES (
      :username, 
      :ipAddress, 
      GETDATE()
    )
  `,
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  userQueries,
  statusQueries,
  caseQueries,
  reportQueries,
  ipAccessQueries,
  adminSessionQueries,
  loggingQueries,
};
