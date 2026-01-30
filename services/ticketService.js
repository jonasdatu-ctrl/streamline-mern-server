/**
 * Ticket Service
 *
 * Modular service for creating and managing case tickets.
 * Mimics the CreateTicket stored procedure functionality.
 */

const { sequelize } = require("../config/database");
const { ticketQueries } = require("../config/queries");
const { replaceTokens } = require("../utils/tokenReplacer");
const { sendTicketEmail } = require("./emailService");

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
    // Step 1: Get email template data if templateId provided
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
      const template = await sequelize.query(ticketQueries.getEmailTemplate, {
        replacements: { templateId },
        type: sequelize.QueryTypes.SELECT,
        transaction: txn,
      });

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

    // Step 2: Get next ticket number
    const ticketNumberResult = await sequelize.query(
      ticketQueries.getNextTicketNumber,
      {
        replacements: { caseId },
        type: sequelize.QueryTypes.SELECT,
        transaction: txn,
      },
    );
    const newTicketNo = ticketNumberResult[0].nextTicketNo;
    const newTicketNoDisplay = `${caseId}-${newTicketNo}-1`;

    // Step 3: Replace tokens in addresses, subject, message
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

    // Step 4: Set defaults for missing addresses
    if (!templateData.fromAddress) {
      templateData.fromAddress = "support@streamlinedental.com";
    }

    if (!templateData.toAddress) {
      // Try to get user email from case
      const userEmail = await sequelize.query(
        ticketQueries.getUserEmailFromCase,
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

    // Step 5: Get current case status
    const caseStatusResult = await sequelize.query(
      ticketQueries.getCaseStatusCode,
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

    // Step 6: Insert case_ticket
    const isDueDateTicketInt = isDueDateTicket ? 1 : 0;
    const assignedTo = assignedToUserId || userId;

    const ticketInsertResult = await sequelize.query(
      ticketQueries.insertCaseTicket,
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

    // Step 7: Insert case_ticket_detail
    const ticketDetailResult = await sequelize.query(
      ticketQueries.insertCaseTicketDetail,
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

    // Step 8: Append ticket assignment log
    // Only log if the most recent assignment is not already to this user
    const updateFlagResult = await sequelize.query(
      ticketQueries.checkTicketAssignmentLog,
      {
        replacements: { detailId: newDetailId, assignedTo },
        type: sequelize.QueryTypes.SELECT,
        transaction: txn,
      },
    );

    const updateFlag = updateFlagResult[0].updateFlag;

    if (updateFlag === 0) {
      await sequelize.query(ticketQueries.insertTicketAssignmentLog, {
        replacements: {
          detailId: newDetailId,
          assignedTo,
          userId,
        },
        type: sequelize.QueryTypes.INSERT,
        transaction: txn,
      });
    }

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
    //     await sendTicketEmail(newDetailId);
    //     console.log(`✓ Email sent for ticket detail ${newDetailId}`);
    //   } catch (emailError) {
    //     console.error(
    //       `Warning: Failed to send email for ticket ${newDetailId}:`,
    //       emailError.message,
    //     );
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

module.exports = {
  createTicket,
};
