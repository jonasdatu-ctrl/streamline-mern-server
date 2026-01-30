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
   * Includes the latest status update from CaseTransactions
   */
  getCaseWithStatus: `
    SELECT TOP 1
      c.Case_ID,
      c.Case_Patient_First_Name,
      CAST(c.Case_Date_Received AS DATE) AS Case_Date_Received,
      CASE WHEN c.IsRushOrder = 'Y' THEN 1 ELSE 0 END AS IsRushOrder,
      s.Status_Streamline_Options,
      (
        SELECT TOP 1 CAST(ct.Case_Date_Record_Created AS DATE)
        FROM dbo.CaseTransaction ct
        WHERE ct.Case_ID = c.Case_ID
        ORDER BY ct.Case_Date_Record_Created DESC
      ) AS Last_Status_Update
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

  /**
   * Insert case item (line item from Shopify)
   */
  insertCaseItem: `
    INSERT INTO dbo.Case_Items (
      Case_Id,
      [name],
      case_item_tooth,
      case_item_qty,
      case_item_shade_ging,
      case_item_shade_body,
      case_item_shade_incis,
      modifier,
      unit_price
    ) VALUES (
      :caseId,
      :name,
      :tooth,
      :qty,
      :shade,
      :shade,
      :shade,
      :qty,
      '0.00'
    );
    SELECT SCOPE_IDENTITY() AS case_item_id
  `,

  /**
   * Insert case item tooth
   */
  insertCaseItemTooth: `
    INSERT INTO dbo.case_item_tooth (
      case_item_id,
      item_tooth
    ) VALUES (
      :caseItemId,
      :itemTooth
    )
  `,

  /**
   * Update case after line items are added
   */
  updateCaseAfterLineItems: `
    UPDATE dbo.[Case]
    SET RXInstructionsReviewed = 'Y',
        ItemTeethShadeReviewed = 'Y',
        CaseType = 1,
        Case_Lab_ID = 52
    WHERE Case_ID = :caseId
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
    WHERE UserId = :userID
  `,

  /**
   * Get session token for username
   */
  getSessionToken: `
    SELECT TOP 1 Token
    FROM dbo.AdminSessionData
    WHERE UserId = :userID
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
// TICKET QUERIES
// =============================================================================

const ticketQueries = {
  /**
   * Get email template by ID
   */
  getEmailTemplate: `
    SELECT 
      subject,
      message,
      Default_From_Address,
      Default_to_Address,
      Default_CC_Address,
      Default_BCC_Address,
      Default_Scheduled_Status_ID
    FROM Email_template 
    WHERE email_template_id = :templateId
  `,

  /**
   * Get next ticket number for a case
   */
  getNextTicketNumber: `
    SELECT COALESCE(MAX(Ticket_Number), 0) + 1 AS nextTicketNo 
    FROM case_ticket 
    WHERE case_id = :caseId
  `,

  /**
   * Get user email from case
   */
  getUserEmailFromCase: `
    SELECT u.EmailAddr 
    FROM v_case c 
    INNER JOIN v_user u ON c.userId = u.userId
    WHERE c.case_id = :caseId
  `,

  /**
   * Get case status code
   */
  getCaseStatusCode: `
    SELECT Case_Status_Code 
    FROM [case] 
    WHERE case_id = :caseId
  `,

  /**
   * Insert case ticket
   */
  insertCaseTicket: `
    INSERT INTO case_ticket (
      case_id, 
      ticket_number, 
      status, 
      IsDueDateTicket, 
      ScheduleDate, 
      ScheduleStatusId
    ) 
    VALUES (
      :caseId, 
      :ticketNumber, 
      :status, 
      :isDueDateTicket, 
      :scheduleDate, 
      :scheduleStatusId
    );
    SELECT SCOPE_IDENTITY() AS newTicketId
  `,

  /**
   * Insert case ticket detail
   */
  insertCaseTicketDetail: `
    INSERT INTO case_ticket_detail (
      Case_Ticket_Id, 
      assignedToUserId, 
      Detail_Number, 
      Action, 
      From_address, 
      To_Address, 
      CC_Address, 
      BCC_Address, 
      Email_Template_Id, 
      Subject, 
      Message, 
      CreatedBy, 
      CaseStatusCode
    ) 
    VALUES (
      :ticketId, 
      :assignedTo, 
      1, 
      'Email', 
      :fromAddr, 
      :toAddr, 
      :ccAddr, 
      :bccAddr, 
      :templateId, 
      :subject, 
      :message, 
      :userId, 
      :statusCode
    );
    SELECT SCOPE_IDENTITY() AS newDetailId
  `,

  /**
   * Check if ticket assignment already logged
   */
  checkTicketAssignmentLog: `
    SELECT COUNT(*) AS updateFlag 
    FROM dbo.Case_Ticket_Assignment_Log 
    WHERE Case_Ticket_Detail_Id = :detailId
      AND RecordTimeAndDate = (
        SELECT MAX(RecordTimeAndDate) 
        FROM dbo.Case_Ticket_Assignment_Log 
        WHERE Case_Ticket_Detail_Id = :detailId
      )
      AND AssignedToUserId = :assignedTo
  `,

  /**
   * Insert ticket assignment log
   */
  insertTicketAssignmentLog: `
    INSERT INTO dbo.Case_Ticket_Assignment_Log (
      Case_Ticket_Detail_Id, 
      AssignedToUserId, 
      UserId, 
      RecordTimeAndDate
    ) 
    VALUES (
      :detailId, 
      :assignedTo, 
      :userId, 
      GETDATE()
    )
  `,

  /**
   * Get case data with all details for token replacement
   * Fetches case, user, customer, shipping, status, and lab information
   */
  getCaseDataForTokens: `
    SELECT 
      c.Case_ID,
      c.Case_Patient_First_Name,
      c.Case_Patient_Last_Name,
      c.Case_Patient_Num,
      c.Case_Date_Received,
      c.Case_Date_Required_By_DR,
      c.Case_Date_Estimated_Return,
      c.Case_Date_Ship_TO_Lab,
      c.Case_Ship_TO_Lab_Track_Num,
      c.Case_Lab_Ref_Number,
      c.Shopify_Email,
      s.Status_Streamline_Options,
      s.Status_Doctor_View,
      s.Description as Status_Description,
      sg.Name as Status_Group_Name,
      u.UserID,
      u.UserName,
      u.UserLogin,
      u.Title,
      u.UserFName,
      u.UserLName,
      u.Password,
      u.EmailAddr,
      u.Fax,
      u.Case_Tracking_Email,
      u.Date_Created,
      cu.Customer_Display_Name,
      cu.CustomerAccountNumber,
      cu.PrimaryDoctorName,
      cu.email as CustomerEmailAddress,
      cu.tel1 as CustomerPhone,
      shipTo.ShipToName,
      shipTo.Address1 as ShipTo_Address1,
      shipTo.Address2 as ShipTo_Address2,
      shipTo.City as ShipTo_City,
      shipTo.State as ShipTo_State,
      shipTo.Zip as ShipTo_Zip,
      shipTo.Phone1 as ShipToPhone1,
      shipTo.InboundCarrierName,
      cu.Name as Customer_Name,
      cu.Address1 as Bill_Address1,
      cu.Address2 as Bill_Address2,
      cu.City as Bill_City,
      cu.State as Bill_State,
      cu.Zip as Bill_Zip,
      p.Name as LabName,
      p.ContactName1 as LabContactName1,
      p.Email as LabEmail,
      p.CC_Email as LabCCEmail
    FROM dbo.[Case] c
    LEFT JOIN dbo.Status s ON c.Case_Status_Code = s.Status_ID
    LEFT JOIN dbo.StatusGroup sg ON s.StatusGroupId = sg.StatusGroupId
    LEFT JOIN v_user u ON c.userId = u.userId
    LEFT JOIN v_customer cu ON u.customerId = cu.customerId
    LEFT JOIN V_CustomerShipTo shipTo ON c.ShipToId = shipTo.customer_shipto_id
    LEFT JOIN dbo.Provider p ON c.Case_Lab_ID = p.ProviderID
    WHERE c.Case_ID = :caseId
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
  ticketQueries,
};
