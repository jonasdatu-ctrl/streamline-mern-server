/**
 * User Model and Database Queries
 *
 * Handles database operations for user authentication.
 * Queries the dbo.User table to verify credentials.
 */

const { sequelize } = require("../config/database");
const { QueryTypes } = require("sequelize");

/**
 * Fetches a user from the database by username
 *
 * @param {string} username - UserLogin column value
 * @returns {Promise<Object|null>} User object with UserId and Password, or null if not found
 * @throws {Error} If database query fails
 */
async function getUserByUsername(username) {
  try {
    const user = await sequelize.query(
      `SELECT TOP 1 UserID, UserLogin, UserName, [Password] FROM dbo.[User] WHERE UserLogin = :username`,
      {
        replacements: { username },
        type: QueryTypes.SELECT,
        raw: true,
      },
    );

    return user.length > 0 ? user[0] : null;
  } catch (error) {
    console.error("Database error fetching user:", error);
    throw new Error(`Failed to fetch user from database: ${error.message}`);
  }
}

/**
 * Verifies user credentials against the database
 *
 * Query plan:
 * 1. Fetch user by username
 * 2. Compare provided password hash with stored password
 * 3. Return user data if match, null if no match
 *
 * @param {string} username - UserLogin to look up
 * @param {string} passwordHash - MD5 hash of password to verify
 * @returns {Promise<Object|null>} User object {UserId, UserLogin} if valid, null if invalid
 * @throws {Error} If database operation fails
 */
async function verifyUserCredentials(username, passwordHash) {
  try {
    const user = await getUserByUsername(username);

    if (!user) {
      return null;
    }

    // Compare case-insensitive (hashes are lowercase)
    if (user.Password.toLowerCase() === passwordHash.toLowerCase()) {
      // Return sanitized user object (exclude password)
      return {
        UserId: user.UserId,
        UserLogin: user.UserLogin,
        UserName: user.UserName
      };
    }

    return null;
  } catch (error) {
    console.error("Error verifying user credentials:", error);
    throw error;
  }
}

module.exports = {
  getUserByUsername,
  verifyUserCredentials,
};
