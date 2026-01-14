/**
 * Database configuration and connection setup.
 * Handles MongoDB connection using Mongoose.
 */

const mongoose = require("mongoose");

/**
 * Connect to MongoDB database.
 * Uses environment variable MONGODB_URI for connection string.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;
