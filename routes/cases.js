/**
 * Cases Routes
 *
 * Handles case management endpoints:
 * - POST /cases/receive-case - Receive a single case ID (database check)
 * - GET /cases/get-case/:caseId - Get case information from database
 * - POST /cases/create-case - Create a new case from Shopify order data
 *
 * All endpoints require authentication via JWT token.
 */

const express = require("express");
const { sequelize } = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const { caseQueries } = require("../config/queries");
const { createTicket } = require("../utils/ticketService");

const router = express.Router();

// Constants
const NUMERIC_PATTERN = /^\d+$/;
const ERROR_CODES = {
  MISSING_CASE_ID: "MISSING_CASE_ID",
  INVALID_CASE_ID: "INVALID_CASE_ID",
  MISSING_CASE_DATA: "MISSING_CASE_DATA",
  DATABASE_ERROR: "DATABASE_ERROR",
  CASE_ALREADY_EXISTS: "CASE_ALREADY_EXISTS",
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
 * Helper: Process order line items and add to case
 * Extracts encoded SKUs from note and line items
 * Pattern: --A1-UL-R33330.1--
 */
const processOrderLineItems = async (
  orderData,
  caseId,
  userId,
  transaction,
) => {
  try {
    // Extract encoded SKUs from note using regex pattern
    const skuPattern = /(--[A-Z0-9]+\-[A-Z]+\-[A-Z0-9\.]+--)/g;
    const noteSkus = [];

    if (orderData.note) {
      const matches = orderData.note.match(skuPattern);
      if (matches) {
        noteSkus.push(...matches);
      }
    }

    // Collect line items with encoded SKUs
    const lineItemSkus = [];
    if (orderData.lineItems && orderData.lineItems.edges) {
      for (const item of orderData.lineItems.edges) {
        const sku = item.node.sku || "";
        if (sku.startsWith("--")) {
          lineItemSkus.push(sku);
        }
      }
    }

    // If no valid SKUs found, create a ticket (template 1363)
    if (noteSkus.length === 0 && lineItemSkus.length === 0) {
      console.log(`No valid SKUs found for case ${caseId}, creating ticket...`);
      await createTicket({
        caseId,
        userId,
        templateId: 1363,
        ticketStatus: 'Open',
      }, transaction);
      
      // Still update the case
      await sequelize.query(caseQueries.updateCaseAfterLineItems, {
        replacements: { caseId },
        type: sequelize.QueryTypes.UPDATE,
        transaction,
      });
      return;
    }

    // Process SKUs from note
    for (const sku of noteSkus) {
      await processEncodedSku(sku, caseId, transaction);
    }

    // Process line items with encoded SKUs
    for (const sku of lineItemSkus) {
      await processEncodedSku(sku, caseId, transaction);
    }

    // Always update case after processing
    await sequelize.query(caseQueries.updateCaseAfterLineItems, {
      replacements: { caseId },
      type: sequelize.QueryTypes.UPDATE,
      transaction,
    });
  } catch (error) {
    console.error("Error processing line items:", error);
    // Don't throw - allow case creation to succeed even if line items fail
  }
};

/**
 * Helper: Parse and process encoded SKU
 * Format: --A1-UL-R33330.1--
 * Parts: shade-upperLower-product
 */
const processEncodedSku = async (sku, caseId, transaction) => {
  try {
    // Remove leading/trailing dashes and replace dots temporarily
    const normalized = sku
      .replace(/\./g, "~")
      .replace(/--/g, "")
      .replace(/-/g, ".");
    const parts = normalized.split(".");

    if (parts.length < 3) {
      console.warn(`Invalid SKU format: ${sku}`);
      return;
    }

    // Extract parts: product.upperLower.shade
    const product = parts[0].replace(/~/g, ".");
    const upperLower = parts[1];
    const shade = parts[2];

    // Determine upper/lower text and quantity
    let toothLocation = "";
    let qty = 1;

    switch (upperLower.toUpperCase()) {
      case "U":
        toothLocation = "Upper";
        qty = 1;
        break;
      case "L":
        toothLocation = "Lower";
        qty = 1;
        break;
      case "UL":
      case "LU":
        toothLocation = "Upper, Lower";
        qty = 2;
        break;
      default:
        toothLocation = "";
        qty = 1;
    }

    // Insert case item
    const result = await sequelize.query(caseQueries.insertCaseItem, {
      replacements: {
        caseId,
        name: product,
        tooth: toothLocation,
        qty,
        shade,
      },
      type: sequelize.QueryTypes.INSERT,
      transaction,
    });

    // Get the inserted case_item_id
    const caseItemId = result[0]?.[0]?.case_item_id;

    if (caseItemId) {
      // Insert tooth records
      if (toothLocation.includes("Upper")) {
        await sequelize.query(caseQueries.insertCaseItemTooth, {
          replacements: {
            caseItemId,
            itemTooth: "Upper",
          },
          type: sequelize.QueryTypes.INSERT,
          transaction,
        });
      }

      if (toothLocation.includes("Lower")) {
        await sequelize.query(caseQueries.insertCaseItemTooth, {
          replacements: {
            caseItemId,
            itemTooth: "Lower",
          },
          type: sequelize.QueryTypes.INSERT,
          transaction,
        });
      }
    }

    console.log(
      `Processed SKU: ${sku} -> Product: ${product}, Tooth: ${toothLocation}, Shade: ${shade}`,
    );
  } catch (error) {
    console.error(`Error processing SKU ${sku}:`, error);
    // Don't throw - allow other SKUs to be processed
  }
};

/**
 * Helper: Extract case data from Shopify order
 * Mimics the .NET ImportOrder logic
 */
const extractCaseDataFromOrder = (orderData, userId) => {
  try {
    // Extract customer info
    const firstName = orderData.customer?.firstName || "";
    const lastName = orderData.customer?.lastName || "";
    const email = orderData.customer?.email || orderData.email || null;

    if (!email) {
      throw new Error("Missing customer email");
    }

    if (!firstName && !lastName) {
      throw new Error(
        "Missing customer first and last name. One must be present.",
      );
    }

    // Build instructions from note and line items
    let instructions = orderData.note || "";
    let isRush = false;

    // Check line items for rush indicators
    if (orderData.lineItems && orderData.lineItems.edges) {
      orderData.lineItems.edges.forEach((item) => {
        const sku = item.node.sku || "";
        const title = item.node.title || "";

        // Add to instructions
        instructions += `\n${sku}\n${title}`;

        // Check for rush order
        if (sku === "R3333" || sku.includes("RUSH")) {
          isRush = true;
        }
      });
    }

    // Check shipping lines for rush
    if (!isRush && orderData.shippingLines) {
      orderData.shippingLines.forEach((line) => {
        if (
          (line.code && line.code.includes("RUSH")) ||
          (line.title && line.title.includes("RUSH"))
        ) {
          isRush = true;
        }
      });
    }

    if (!instructions) {
      throw new Error("Failed to generate instructions. No note or line items");
    }

    // Extract order number from order name (e.g., "88675969")
    const orderNumber = orderData.name;

    return {
      caseId: orderNumber,
      firstName: firstName.substring(0, 255),
      lastName: lastName.substring(0, 255),
      email: email.substring(0, 255),
      instructions: instructions.substring(0, 4000), // SQL max for varchar
      userId,
      isRush,
      orderNumber,
    };
  } catch (error) {
    throw new Error(`Failed to extract case data: ${error.message}`);
  }
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
    const result = await sequelize.query(caseQueries.getCaseWithStatus, {
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

    const result = await sequelize.query(caseQueries.getCaseById, {
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
    const { statusCode, data } = formatErrorResponse(
      "Failed to fetch case information",
    );
    res.status(statusCode).json(data);
  }
});

/**
 * POST /cases/create-case
 *
 * Creates a new case in the database from Shopify order data.
 * Inserts entries into dbo.[Case] and dbo.CaseTransaction tables.
 *
 * Request body:
 * {
 *   "orderData": {
 *     "name": "88675969",
 *     "customer": {
 *       "firstName": "string",
 *       "lastName": "string",
 *       "email": "string"
 *     },
 *     "note": "string",
 *     "lineItems": [ { "sku": "string", "title": "string" }, ... ],
 *     "shippingLines": [ { "code": "string", "title": "string" }, ... ]
 *   }
 * }
 *
 * Response on success (201):
 * {
 *   "status": "success",
 *   "message": "Case created successfully",
 *   "data": {
 *     "caseId": "88675969",
 *     "orderNumber": "88675969"
 *   }
 * }
 *
 * Response on error (400/500):
 * {
 *   "status": "error",
 *   "message": "Error description",
 *   "code": "ERROR_CODE"
 * }
 */
router.post("/create-case", verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { orderData } = req.body;
    const authUser = req.user; // From JWT middleware

    // Validate orderData
    if (!orderData) {
      return res.status(400).json({
        status: "error",
        message: "orderData is required",
        code: ERROR_CODES.MISSING_CASE_DATA,
      });
    }

    console.log(`Creating case from order ${orderData.name}...`);

    // Extract and validate case data from Shopify order
    const caseData = extractCaseDataFromOrder(orderData, authUser.UserId);

    // Check if case already exists
    const existingCase = await sequelize.query(caseQueries.checkCaseExists, {
      replacements: { caseId: caseData.caseId },
      type: sequelize.QueryTypes.SELECT,
      raw: true,
      transaction,
    });

    if (existingCase && existingCase.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "Case has already been imported",
        code: ERROR_CODES.CASE_ALREADY_EXISTS,
      });
    }

    // Insert into dbo.[Case]
    const daysRequired = caseData.isRush ? 7 : 14;

    await sequelize.query(caseQueries.insertCase, {
      replacements: {
        caseId: caseData.caseId,
        userId: 8437, // Default lab user
        customerId: 2283, // Default customer (Shopify)
        daysRequired,
        firstName: caseData.firstName,
        lastName: caseData.lastName,
        orderNumber: caseData.orderNumber,
        email: caseData.email,
        instructions: caseData.instructions,
        statusCode: 10,
        labId: 52,
        shipToId: 2595,
        invoiceFee: 0,
        poNumber: caseData.orderNumber,
        carrierId: 102,
        isRush: caseData.isRush ? 1 : 0,
      },
      type: sequelize.QueryTypes.INSERT,
      transaction,
    });

    // Insert into dbo.CaseTransaction
    await sequelize.query(caseQueries.insertCaseTransaction, {
      replacements: {
        caseId: caseData.caseId,
        employeeId: authUser.UserName,
        userId: authUser.UserId,
        statusCode: 10,
        carrierId: 102,
      },
      type: sequelize.QueryTypes.INSERT,
      transaction,
    });

    // Process line items from order (encoded SKUs)
    await processOrderLineItems(
      orderData,
      caseData.caseId,
      authUser.UserId,
      transaction,
    );

    // Commit transaction
    await transaction.commit();

    console.log(`Case ${caseData.caseId} created successfully`);

    res.status(201).json({
      status: "success",
      message: "Case created successfully",
      data: {
        caseId: caseData.caseId,
        orderNumber: caseData.orderNumber,
      },
    });
  } catch (error) {
    // Rollback on error
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Error creating case:", error);

    let statusCode = 500;
    let errorCode = ERROR_CODES.DATABASE_ERROR;
    let message = error.message || "Failed to create case";

    if (error.message.includes("Missing")) {
      statusCode = 400;
      errorCode = ERROR_CODES.MISSING_CASE_DATA;
    }

    res.status(statusCode).json({
      status: "error",
      message,
      code: errorCode,
      ...(process.env.NODE_ENV === "development" && { details: error.message }),
    });
  }
});

module.exports = router;
