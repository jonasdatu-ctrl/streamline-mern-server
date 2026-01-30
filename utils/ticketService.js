/**
 * Ticket Service
 *
 * Modular service for creating and managing case tickets.
 * Mimics the CreateTicket stored procedure functionality.
 */

const { sequelize } = require("../config/database");
const https = require("https");

/**
 * Create a new ticket for a case
 *
 * @param {Object} options - Ticket creation options
 * @param {number} options.caseId - Case ID
 * @param {number} options.userId - User creating the ticket
 * @param {number} [options.templateId] - Email template ID (optional)
 * @param {string} [options.ticketStatus='Closed'] - Ticket status (Open, Closed, Scheduled)
 * @param {boolean} [options.isDueDateTicket=false] - Is this a due date ticket
 * @param {Date} [options.ticketScheduleDate] - Schedule date (for Scheduled status)
 * @param {number} [options.ticketScheduleStatusId] - Schedule status ID
 * @param {number} [options.assignedToUserId] - User to assign ticket to (defaults to userId)
 * @param {string} [options.fromAddress] - From email address
 * @param {string} [options.toAddress] - To email address
 * @param {string} [options.ccAddress] - CC email address
 * @param {string} [options.bccAddress] - BCC email address
 * @param {string} [options.subject] - Email subject
 * @param {string} [options.message] - Email message
 * @param {string} [options.overrideSubject] - Override template subject
 * @param {string} [options.overrideMessage] - Override template message
 * @param {boolean} [options.sendEmail=true] - Whether to send email notification
 * @param {Object} [transaction] - Sequelize transaction (optional)
 * @returns {Promise<number>} Created case ticket detail ID
 */
async function createTicket(options, transaction = null) {
  const {
    caseId,
    userId,
    templateId = null,
    ticketStatus = "Closed",
    isDueDateTicket = false,
    ticketScheduleDate = null,
    ticketScheduleStatusId = null,
    assignedToUserId = null,
    fromAddress = null,
    toAddress = null,
    ccAddress = null,
    bccAddress = null,
    subject = null,
    message = null,
    overrideSubject = null,
    overrideMessage = null,
    sendEmail = true,
  } = options;

  // Determine if we need to manage transaction
  const shouldCommit = !transaction;
  const txn = transaction || (await sequelize.transaction());

  try {
    // Step 1: Check if case exists, create if needed (for customer orders)
    // const customerCheck = await sequelize.query(
    //   `SELECT customerId FROM Customer WHERE Customer_Account_Number = :caseId`,
    //   {
    //     replacements: { caseId },
    //     type: sequelize.QueryTypes.SELECT,
    //     transaction: txn,
    //   }
    // );

    // if (customerCheck.length > 0) {
    //   const customerId = customerCheck[0].customerId;
    //   const caseExists = await sequelize.query(
    //     `SELECT Case_ID FROM dbo.[Case] WHERE Case_ID = :caseId`,
    //     {
    //       replacements: { caseId },
    //       type: sequelize.QueryTypes.SELECT,
    //       transaction: txn,
    //     }
    //   );

    //   if (caseExists.length === 0) {
    //     // Create new case if it doesn't exist
    //     await sequelize.query(
    //       `EXEC dbo.CreateNewCase @CustomerId = :customerId, @UserId = :userId`,
    //       {
    //         replacements: { customerId, userId },
    //         type: sequelize.QueryTypes.RAW,
    //         transaction: txn,
    //       }
    //     );
    //   }
    // }

    // Step 2: Get email template data if templateId provided
    let templateData = {
      subject: subject,
      message: message,
      fromAddress: fromAddress,
      toAddress: toAddress,
      ccAddress: ccAddress,
      bccAddress: bccAddress,
      scheduleStatusId: ticketScheduleStatusId,
    };

    if (templateId) {
      const template = await sequelize.query(
        `SELECT 
          subject,
          message,
          Default_From_Address,
          Default_to_Address,
          Default_CC_Address,
          Default_BCC_Address,
          Default_Scheduled_Status_ID
        FROM Email_template 
        WHERE email_template_id = :templateId`,
        {
          replacements: { templateId },
          type: sequelize.QueryTypes.SELECT,
          transaction: txn,
        },
      );

      if (template.length > 0) {
        const t = template[0];
        templateData.subject = subject || t.subject;
        templateData.message = message || t.message;
        templateData.fromAddress = fromAddress || t.Default_From_Address;

        // Merge addresses with template defaults
        const toAddrs = [t.Default_to_Address, toAddress].filter(Boolean);
        const ccAddrs = [t.Default_CC_Address, ccAddress].filter(Boolean);
        const bccAddrs = [t.Default_BCC_Address, bccAddress].filter(Boolean);

        templateData.toAddress = toAddrs.join(";");
        templateData.ccAddress = ccAddrs.join(";");
        templateData.bccAddress = bccAddrs.join(";");

        if (ticketStatus === "Scheduled") {
          templateData.scheduleStatusId =
            ticketScheduleStatusId || t.Default_Scheduled_Status_ID;
        }
      }
    }

    // Step 3: Get next ticket number
    const ticketNumberResult = await sequelize.query(
      `SELECT COALESCE(MAX(Ticket_Number), 0) + 1 AS nextTicketNo 
       FROM case_ticket 
       WHERE case_id = :caseId`,
      {
        replacements: { caseId },
        type: sequelize.QueryTypes.SELECT,
        transaction: txn,
      },
    );
    const newTicketNo = ticketNumberResult[0].nextTicketNo;
    const newTicketNoDisplay = `${caseId}-${newTicketNo}-1`;

    // Step 4: Replace tokens in addresses, subject, message
    templateData.fromAddress = await replaceTokens(
      templateData.fromAddress,
      caseId,
      newTicketNoDisplay,
      txn,
    );
    templateData.toAddress = await replaceTokens(
      templateData.toAddress,
      caseId,
      newTicketNoDisplay,
      txn,
    );
    templateData.subject = await replaceTokens(
      templateData.subject,
      caseId,
      newTicketNoDisplay,
      txn,
    );
    templateData.message = await replaceTokens(
      templateData.message,
      caseId,
      newTicketNoDisplay,
      txn,
    );

    // Step 5: Set defaults for missing addresses
    if (!templateData.fromAddress) {
      templateData.fromAddress = "support@streamlinedental.com";
    }

    if (!templateData.toAddress) {
      // Try to get user email from case
      const userEmail = await sequelize.query(
        `SELECT u.EmailAddr 
         FROM v_case c 
         INNER JOIN v_user u ON c.userId = u.userId
         WHERE c.case_id = :caseId`,
        {
          replacements: { caseId },
          type: sequelize.QueryTypes.SELECT,
          transaction: txn,
        },
      );

      templateData.toAddress =
        userEmail.length > 0
          ? userEmail[0].EmailAddr
          : "support@streamlinedental.com";
    }

    // Step 6: Get current case status
    const caseStatusResult = await sequelize.query(
      `SELECT Case_Status_Code FROM [case] WHERE case_id = :caseId`,
      {
        replacements: { caseId },
        type: sequelize.QueryTypes.SELECT,
        transaction: txn,
      },
    );
    const caseStatusCode =
      caseStatusResult.length > 0 ? caseStatusResult[0].Case_Status_Code : null;

    // Apply overrides if provided
    if (overrideSubject) templateData.subject = overrideSubject;
    if (overrideMessage) templateData.message = overrideMessage;

    // Step 7: Insert case_ticket
    const isDueDateTicketInt = isDueDateTicket ? 1 : 0;
    const assignedTo = assignedToUserId || userId;

    const ticketInsertResult = await sequelize.query(
      `INSERT INTO case_ticket (case_id, ticket_number, status, IsDueDateTicket, ScheduleDate, ScheduleStatusId) 
       VALUES (:caseId, :ticketNumber, :status, :isDueDateTicket, :scheduleDate, :scheduleStatusId);
       SELECT SCOPE_IDENTITY() AS newTicketId`,
      {
        replacements: {
          caseId,
          ticketNumber: newTicketNo,
          status: ticketStatus,
          isDueDateTicket: isDueDateTicketInt,
          scheduleDate: ticketScheduleDate,
          scheduleStatusId: templateData.scheduleStatusId,
        },
        type: sequelize.QueryTypes.INSERT,
        transaction: txn,
      },
    );
    const newTicketId = ticketInsertResult[0][0].newTicketId;

    // Step 8: Insert case_ticket_detail
    const ticketDetailResult = await sequelize.query(
      `INSERT INTO case_ticket_detail 
       (Case_Ticket_Id, assignedToUserId, Detail_Number, Action, From_address, To_Address, 
        CC_Address, BCC_Address, Email_Template_Id, Subject, Message, CreatedBy, CaseStatusCode) 
       VALUES 
       (:ticketId, :assignedTo, 1, 'Email', :fromAddr, :toAddr, :ccAddr, :bccAddr, 
        :templateId, :subject, :message, :userId, :statusCode);
       SELECT SCOPE_IDENTITY() AS newDetailId`,
      {
        replacements: {
          ticketId: newTicketId,
          assignedTo,
          fromAddr: templateData.fromAddress,
          toAddr: templateData.toAddress,
          ccAddr: templateData.ccAddress || "",
          bccAddr: templateData.bccAddress || "",
          templateId,
          subject: templateData.subject,
          message: templateData.message,
          userId,
          statusCode: caseStatusCode,
        },
        type: sequelize.QueryTypes.INSERT,
        transaction: txn,
      },
    );
    const newDetailId = ticketDetailResult[0][0].newDetailId;

    // Step 9: Append ticket assignment log
    // await sequelize.query(
    //   `EXEC dbo.usp_AppendTicketAssignmentLog 
    //    @CaseTicketDetailId = :detailId,
    //    @AssignedToUserId = :assignedTo,
    //    @UserId = :userId`,
    //   {
    //     replacements: {
    //       detailId: newDetailId,
    //       assignedTo,
    //       userId,
    //     },
    //     type: sequelize.QueryTypes.RAW,
    //     transaction: txn,
    //   },
    // );

    // Commit transaction if we created it
    if (shouldCommit) {
      await txn.commit();
    }

    console.log(
      `✓ Ticket created for case ${caseId}: Detail ID ${newDetailId}`,
    );

    // Send email notification if requested
    // if (sendEmail) {
    //   try {
    //     await sendEmailTicket(newDetailId);
    //     console.log(`✓ Email sent for ticket detail ${newDetailId}`);
    //   } catch (emailError) {
    //     console.error(`Warning: Failed to send email for ticket ${newDetailId}:`, emailError.message);
    //     // Don't throw - ticket was created successfully
    //   }
    // }

    return newDetailId;
  } catch (error) {
    // Rollback if we created the transaction
    if (shouldCommit && txn) {
      await txn.rollback();
    }
    console.error(`Error creating ticket for case ${caseId}:`, error);
    throw error;
  }
}

/**
 * Send email for a ticket
 * Makes HTTP request to Streamline email sending endpoint
 * 
 * @param {number} ticketDetailId - Case ticket detail ID
 * @param {string} [attachmentPath] - Optional file path for attachment (e.g., "C:\path\to\file.pdf")
 * @returns {Promise<void>}
 */
async function sendEmailTicket(ticketDetailId, attachmentPath = null) {
  if (!ticketDetailId || ticketDetailId < 1) {
    throw new Error('ticketDetailId must be greater than zero');
  }

  const wwwroot = process.env.STREAMLINE_WEB_ROOT || 'https://www.streamlinedental.com';
  let url = `${wwwroot}/Secure/Tickets/SendTicketEmail.asp?TicketDetailId=${ticketDetailId}`;
  
  // Add attachment parameter if provided
  if (attachmentPath) {
    // URL encode the attachment path
    const encodedPath = encodeURIComponent(attachmentPath);
    url += `&attach=${encodedPath}`;
  }

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Email send failed with status ${response.statusCode}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(new Error(`Email send request failed: ${error.message}`));
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Email send request timed out'));
    });
  });
}

/**
 * Replace tokens in a string (e.g., @@CASE_ID, @@TICKET_NUMBER)
 * JavaScript implementation - does not call stored procedure
 * 
 * @param {string} text - Text with tokens to replace
 * @param {number} caseId - Case ID
 * @param {string} ticketNumber - Ticket number display
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<string>} Text with tokens replaced
 */
async function replaceTokens(text, caseId, ticketNumber, transaction) {
  // Early return if no text or no tokens to replace
  if (!text || text === '' || !text.includes('@@')) {
    return text || '';
  }

  try {
    // Fetch case data with all necessary joins
    const caseData = await sequelize.query(
      `SELECT 
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
      WHERE c.Case_ID = :caseId`,
      {
        replacements: { caseId },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    if (caseData.length === 0) {
      console.warn(`No case data found for case ${caseId}, returning original text`);
      return text;
    }

    const data = caseData[0];
    
    // Helper function to format date
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    // Helper function to format address
    const formatAddress = (name, addr1, addr2, city, state, zip) => {
      let address = name || '';
      if (addr1) address += (address ? '\r\n' : '') + addr1;
      if (addr2 && addr2.trim()) address += '\r\n' + addr2;
      if (city) address += (address ? '\r\n' : '') + city + ',';
      if (state) address += ' ' + state;
      if (zip) address += ' ' + zip;
      return address;
    };

    // Build replacement map
    const replacements = {
      '@@CASE_ID': caseId.toString(),
      '@@TODAY': formatDate(new Date()),
      '@@TICKET_NUMBER': ticketNumber || '',
      
      // Patient info
      '@@PATIENT_NAME': `${data.Case_Patient_First_Name || ''} ${data.Case_Patient_Last_Name || ''} #${data.Case_Patient_Num || ''}`.trim(),
      '@@PATIENT_FIRST': data.Case_Patient_First_Name || '',
      '@@PATIENT_LAST': data.Case_Patient_Last_Name || '',
      '@@PATIENT_NUMBER': data.Case_Patient_Num || '',
      
      // Doctor info
      '@@DOCTOR_NAME': `${data.Title || ''} ${data.UserFName || ''} ${data.UserLName || ''}`.trim(),
      '@@DOCTOR_LNAME': `${data.Title || ''} ${data.UserLName || ''}`.trim(),
      '@@DOCTOR_LASTNAME': `${data.Title || ''} ${data.UserLName || ''}`.trim(),
      '@@DOCTOR_LOGIN': data.UserLogin || '',
      '@@USERLOGIN': data.UserLogin || '',
      '@@PASSWORD': data.Password || '',
      '@@DOCTOR_SUPPORT_EMAIL': data.EmailAddr || '',
      '@@DOCTOR_TRACKING_EMAIL': data.Case_Tracking_Email || '',
      '@@DOCTOR_FAX': data.Fax || '',
      '@@DOCTOR_FAX_EMAIL': data.Fax ? `${data.Fax}@rapidfax.com` : '',
      '@@DOCTOR_ID': (data.UserID || '').toString(),
      '@@CASEEMPLOYEEFIRST': data.UserFName || '',
      '@@DATE_USER_CREATED': formatDate(data.Date_Created),
      
      // Customer info
      '@@CUSTOMER_NAME': data.Customer_Display_Name || '',
      '@@CUSTOMER_ACCOUNT_NUMBER': data.CustomerAccountNumber || '',
      '@@PRIMARY_DOCTOR': data.PrimaryDoctorName || '',
      '@@CUSTOMER_BILLING_EMAIL': data.CustomerEmailAddress || '',
      '@@CUSTOMER_ACCOUNTING_EMAIL': data.CustomerEmailAddress || '',
      '@@BILLINGPHONE': data.CustomerPhone || '',
      
      // Addresses
      '@@CASECUSTOMERBILLTO': formatAddress(data.Customer_Name, data.Bill_Address1, data.Bill_Address2, data.Bill_City, data.Bill_State, data.Bill_Zip),
      '@@CASECUSTOMERSHIPTO': formatAddress(data.ShipToName, data.ShipTo_Address1, data.ShipTo_Address2, data.ShipTo_City, data.ShipTo_State, data.ShipTo_Zip),
      '@@SHIPPINGPHONE': data.ShipToPhone1 || '',
      '@@INBOUND_CARRIER': data.InboundCarrierName || '',
      
      // Status info
      '@@STATUS_STREAMLINE_OPTIONS': data.Status_Streamline_Options || '',
      '@@STATUS_DOCTOR_VIEW': data.Status_Doctor_View || '',
      '@@STATUS_DESCRIPTION': data.Status_Description || '',
      '@@STATUS_GROUP': data.Status_Group_Name || '',
      '@@STATUS': data.Status_Doctor_View || '',
      
      // Dates
      '@@DATE_RECEIVED': formatDate(data.Case_Date_Received),
      '@@DUE_DATE': formatDate(data.Case_Date_Required_By_DR),
      '@@DATE_DUE': formatDate(data.Case_Date_Required_By_DR),
      '@@DATE_ESTIMATED_RETURN': formatDate(data.Case_Date_Estimated_Return),
      '@@CASE_DATE_SHIP_TO_LAB': formatDate(data.Case_Date_Ship_TO_Lab),
      
      // Lab info
      '@@LABNAME': data.LabName || '',
      '@@LABCONTACTNAME1': data.LabContactName1 || '',
      '@@LABEMAIL': data.LabEmail || '',
      '@@LABCCEMAIL': data.LabCCEmail || '',
      '@@LAB_REF_NUMBER': data.Case_Lab_Ref_Number || '',
      '@@CASE_SHIP_TO_LAB_TRACK_NUM': data.Case_Ship_TO_Lab_Track_Num || '',
      
      // Shopify
      '@@SHOPIFY_EMAIL': data.Shopify_Email || '',
    };

    // Perform replacements
    let result = text;
    for (const [token, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    return result;

  } catch (error) {
    console.warn(
      `Warning: Token replacement failed for case ${caseId}:`,
      error.message,
    );
    return text;
  }
}

module.exports = {
  createTicket,
  replaceTokens,
  sendEmailTicket,
};
