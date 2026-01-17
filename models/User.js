/**
 * User model for the Streamline Shopify App.
 * Defines the table schema for users in SQL Server using Sequelize.
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
  },
  {
    timestamps: true,
    tableName: "Users",
  }
);

module.exports = User;
