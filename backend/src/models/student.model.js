const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const studentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    admissionNumber: { type: String, required: true, trim: true, uppercase: true },
    registrationNumber: { type: String, trim: true, uppercase: true },
    fullName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    motherName: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    dateOfBirth: { type: Date, required: true },
    bFormNumber: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    alternativePhone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    admissionDate: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'inactive', 'transferred', 'graduated', 'suspended'],
      default: 'active',
      index: true,
    },
    currentEnrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentEnrollment' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

studentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });
studentSchema.index(
  { schoolId: 1, registrationNumber: 1 },
  { unique: true, partialFilterExpression: { registrationNumber: { $type: 'string', $gt: '' } } }
);
studentSchema.index(
  { schoolId: 1, bFormNumber: 1 },
  { unique: true, partialFilterExpression: { bFormNumber: { $type: 'string', $gt: '' } } }
);
studentSchema.index({ schoolId: 1, fullName: 1 });

module.exports = createTenantModel('Student', studentSchema);
