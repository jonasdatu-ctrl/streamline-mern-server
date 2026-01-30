/**
 * Token Replacer Utility
 *
 * Replaces tokens in text strings with case data values.
 * Tokens follow the format @@TOKEN_NAME
 *
 * Examples: @@CASE_ID, @@PATIENT_NAME, @@DOCTOR_EMAIL, etc.
 */

const { sequelize } = require("../config/database");

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
  if (!text || text === "" || !text.includes("@@")) {
    return text || "";
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
      },
    );

    if (caseData.length === 0) {
      console.warn(
        `No case data found for case ${caseId}, returning original text`,
      );
      return text;
    }

    const data = caseData[0];

    // Helper function to format date
    const formatDate = (date) => {
      if (!date) return "";
      const d = new Date(date);
      return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}/${d.getFullYear()}`;
    };

    // Helper function to format address
    const formatAddress = (name, addr1, addr2, city, state, zip) => {
      let address = name || "";
      if (addr1) address += (address ? "\r\n" : "") + addr1;
      if (addr2 && addr2.trim()) address += "\r\n" + addr2;
      if (city) address += (address ? "\r\n" : "") + city + ",";
      if (state) address += " " + state;
      if (zip) address += " " + zip;
      return address;
    };

    // Build replacement map
    const replacements = {
      "@@CASE_ID": caseId.toString(),
      "@@TODAY": formatDate(new Date()),
      "@@TICKET_NUMBER": ticketNumber || "",

      // Patient info
      "@@PATIENT_NAME":
        `${data.Case_Patient_First_Name || ""} ${data.Case_Patient_Last_Name || ""} #${data.Case_Patient_Num || ""}`.trim(),
      "@@PATIENT_FIRST": data.Case_Patient_First_Name || "",
      "@@PATIENT_LAST": data.Case_Patient_Last_Name || "",
      "@@PATIENT_NUMBER": data.Case_Patient_Num || "",

      // Doctor info
      "@@DOCTOR_NAME":
        `${data.Title || ""} ${data.UserFName || ""} ${data.UserLName || ""}`.trim(),
      "@@DOCTOR_LNAME": `${data.Title || ""} ${data.UserLName || ""}`.trim(),
      "@@DOCTOR_LASTNAME": `${data.Title || ""} ${data.UserLName || ""}`.trim(),
      "@@DOCTOR_LOGIN": data.UserLogin || "",
      "@@USERLOGIN": data.UserLogin || "",
      "@@PASSWORD": data.Password || "",
      "@@DOCTOR_SUPPORT_EMAIL": data.EmailAddr || "",
      "@@DOCTOR_TRACKING_EMAIL": data.Case_Tracking_Email || "",
      "@@DOCTOR_FAX": data.Fax || "",
      "@@DOCTOR_FAX_EMAIL": data.Fax ? `${data.Fax}@rapidfax.com` : "",
      "@@DOCTOR_ID": (data.UserID || "").toString(),
      "@@CASEEMPLOYEEFIRST": data.UserFName || "",
      "@@DATE_USER_CREATED": formatDate(data.Date_Created),

      // Customer info
      "@@CUSTOMER_NAME": data.Customer_Display_Name || "",
      "@@CUSTOMER_ACCOUNT_NUMBER": data.CustomerAccountNumber || "",
      "@@PRIMARY_DOCTOR": data.PrimaryDoctorName || "",
      "@@CUSTOMER_BILLING_EMAIL": data.CustomerEmailAddress || "",
      "@@CUSTOMER_ACCOUNTING_EMAIL": data.CustomerEmailAddress || "",
      "@@BILLINGPHONE": data.CustomerPhone || "",

      // Addresses
      "@@CASECUSTOMERBILLTO": formatAddress(
        data.Customer_Name,
        data.Bill_Address1,
        data.Bill_Address2,
        data.Bill_City,
        data.Bill_State,
        data.Bill_Zip,
      ),
      "@@CASECUSTOMERSHIPTO": formatAddress(
        data.ShipToName,
        data.ShipTo_Address1,
        data.ShipTo_Address2,
        data.ShipTo_City,
        data.ShipTo_State,
        data.ShipTo_Zip,
      ),
      "@@SHIPPINGPHONE": data.ShipToPhone1 || "",
      "@@INBOUND_CARRIER": data.InboundCarrierName || "",

      // Status info
      "@@STATUS_STREAMLINE_OPTIONS": data.Status_Streamline_Options || "",
      "@@STATUS_DOCTOR_VIEW": data.Status_Doctor_View || "",
      "@@STATUS_DESCRIPTION": data.Status_Description || "",
      "@@STATUS_GROUP": data.Status_Group_Name || "",
      "@@STATUS": data.Status_Doctor_View || "",

      // Dates
      "@@DATE_RECEIVED": formatDate(data.Case_Date_Received),
      "@@DUE_DATE": formatDate(data.Case_Date_Required_By_DR),
      "@@DATE_DUE": formatDate(data.Case_Date_Required_By_DR),
      "@@DATE_ESTIMATED_RETURN": formatDate(data.Case_Date_Estimated_Return),
      "@@CASE_DATE_SHIP_TO_LAB": formatDate(data.Case_Date_Ship_TO_Lab),

      // Lab info
      "@@LABNAME": data.LabName || "",
      "@@LABCONTACTNAME1": data.LabContactName1 || "",
      "@@LABEMAIL": data.LabEmail || "",
      "@@LABCCEMAIL": data.LabCCEmail || "",
      "@@LAB_REF_NUMBER": data.Case_Lab_Ref_Number || "",
      "@@CASE_SHIP_TO_LAB_TRACK_NUM": data.Case_Ship_TO_Lab_Track_Num || "",

      // Shopify
      "@@SHOPIFY_EMAIL": data.Shopify_Email || "",
    };

    // Perform replacements
    let result = text;
    for (const [token, value] of Object.entries(replacements)) {
      result = result.replace(
        new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        value,
      );
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
  replaceTokens,
};
