const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'School address is required'],
    },
    phone: {
      type: String,
      required: [true, 'School phone number is required'],
    },
    email: {
      type: String,
      required: [true, 'School email is required'],
      unique: true,
      lowercase: true,
    },
    logo: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    // Future extensible fields
    subscriptionExpiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'school', // Explicitly setting collection name as requested
  }
);

module.exports = createTenantModel('School', schoolSchema);
