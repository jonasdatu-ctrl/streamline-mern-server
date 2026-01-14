/**
 * User model for the Streamline Shopify App.
 * Defines the schema for user documents in MongoDB.
 */

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Basic user information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // Additional fields (can be expanded as needed)
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Index for faster queries
userSchema.index({ email: 1 });

// Pre-save middleware to update updatedAt
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method example
userSchema.methods.getFullName = function () {
  return this.name;
};

// Static method example
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

module.exports = mongoose.model("User", userSchema);
