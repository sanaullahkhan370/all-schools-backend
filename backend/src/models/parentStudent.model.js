const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const parentStudentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    relationship: {
      type: String,
      enum: ['father', 'mother', 'guardian', 'other'],
      default: 'father',
    },
    isPrimaryGuardian: { type: Boolean, default: true },
    canViewAcademicData: { type: Boolean, default: true },
    canPayFees: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

parentStudentSchema.index({ schoolId: 1, parentId: 1, studentId: 1 }, { unique: true });

module.exports = createTenantModel('ParentStudent', parentStudentSchema);
