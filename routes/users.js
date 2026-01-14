/**
 * User routes for the Streamline Shopify App.
 * Defines API endpoints for user-related operations.
 */

const express = require("express");
const router = express.Router();

// Import controller functions
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/userController");

// Import middleware (add authentication middleware when implemented)
// const { protect, authorize } = require('../middleware/auth');

// Routes
router
  .route("/")
  .get(getUsers) // GET /api/users - Get all users
  .post(createUser); // POST /api/users - Create new user

router
  .route("/:id")
  .get(getUser) // GET /api/users/:id - Get single user
  .put(updateUser) // PUT /api/users/:id - Update user
  .delete(deleteUser); // DELETE /api/users/:id - Delete user

module.exports = router;
