const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const termSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(value) { return !this.startDate || value > this.startDate; },
        message: 'End date must be after start date',
      },
    },
    resultPublishDate: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'resultPublished'],
      default: 'draft',
    },
    isResultPublished: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

termSchema.index({ schoolId: 1, academicSessionId: 1, name: 1 }, { unique: true });

module.exports = createTenantModel('Term', termSchema);
