/**
 * Database configuration and connection setup.
 * Handles SQL Server connection using Sequelize ORM.
 * All configuration values are required to be set in environment variables.
 */

const { Sequelize } = require("sequelize");

// Validate required environment variables
const requiredEnvVars = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

/**
 * Initialize Sequelize with SQL Server connection.
 * All connection parameters come from environment variables.
 */
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mssql",
    dialectOptions: {
      options: {
        useUTC: false,
        dateFirst: 1,
        encrypt: true,
        trustServerCertificate: true, // <--- change this
      },
    },

    logging: process.env.NODE_ENV === "development" ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

/**
 * Connect to SQL Server database.
 */
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("SQL Server Connected successfully");

    // Sync all models with the database (creates tables if they don't exist)
    // Use { alter: true } to modify tables, or { force: true } to drop and recreate
    await sequelize.sync({ alter: false });
    console.log("Database models synchronized");

    // Test: Count entries in dbo.[User] table
    const userCount = await sequelize.query(
      "SELECT COUNT(*) as count FROM dbo.[User]",
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log(`Total entries in dbo.[User] table: ${userCount[0].count}`);
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1); // Exit process with failure
  }
};

module.exports = { sequelize, connectDB };
