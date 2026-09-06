const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const noticeSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    audience: {
      type: String,
      enum: ['all', 'parent', 'teacher', 'admin'],
      default: 'all',
      index: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'important', 'urgent'],
      default: 'normal',
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: Date,
    expiresAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

noticeSchema.index({ schoolId: 1, status: 1, audience: 1, publishedAt: -1 });

module.exports = createTenantModel('Notice', noticeSchema);
