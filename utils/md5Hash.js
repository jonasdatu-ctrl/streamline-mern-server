/**
 * MD5 Hashing Utility - Classic ASP Compatible
 *
 * Replicates the behavior of Classic ASP's md5(server.HTMLEncode(password))
 * using single-byte/ANSI encoding and returning lowercase hex output.
 *
 * This ensures compatibility with passwords stored in the database
 * using the same hashing mechanism.
 */

const crypto = require("crypto");

/**
 * HTML encodes a string to match Classic ASP server.HTMLEncode behavior
 * Converts special characters to HTML entities
 *
 * @param {string} str - String to encode
 * @returns {string} HTML-encoded string
 */
function htmlEncode(str) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Encodes a string to ANSI (single-byte) format
 * Ensures characters are in single-byte representation
 *
 * @param {string} str - String to encode
 * @returns {Buffer} ANSI-encoded buffer
 */
function toANSI(str) {
  // Create a buffer with latin1 encoding (ISO-8859-1) for single-byte representation
  return Buffer.from(str, "latin1");
}

/**
 * Hashes a password using MD5 with Classic ASP compatibility
 * Replicates: md5(server.HTMLEncode(password))
 *
 * Process:
 * 1. HTML encode the password
 * 2. Convert to ANSI (single-byte) encoding
 * 3. Generate MD5 hash
 * 4. Return as lowercase hex string
 *
 * @param {string} password - Password to hash
 * @returns {string} Lowercase MD5 hash in hexadecimal format
 * @throws {Error} If password is not a string or is empty
 */
function hashPassword(password) {
  // Validation
  if (typeof password !== "string") {
    throw new Error("Password must be a string");
  }

  if (password.length === 0) {
    throw new Error("Password cannot be empty");
  }

  try {
    // Step 1: HTML encode
    const encoded = htmlEncode(password);

    // Step 2: Convert to ANSI (single-byte)
    const ansiBuffer = toANSI(encoded);

    // Step 3: Generate MD5 hash
    const hash = crypto.createHash("md5").update(ansiBuffer).digest("hex");

    // Step 4: Return lowercase hex (already lowercase from digest)
    return hash.toLowerCase();
  } catch (error) {
    throw new Error(`Failed to hash password: ${error.message}`);
  }
}

/**
 * Compares a plain-text password with a stored MD5 hash
 * Uses the same hashing mechanism to ensure consistency
 *
 * @param {string} plainPassword - Plain-text password to verify
 * @param {string} storedHash - Stored MD5 hash from database
 * @returns {boolean} True if password matches hash, false otherwise
 */
function verifyPassword(plainPassword, storedHash) {
  try {
    const computedHash = hashPassword(plainPassword);
    return computedHash === storedHash.toLowerCase();
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  htmlEncode,
  toANSI,
};
