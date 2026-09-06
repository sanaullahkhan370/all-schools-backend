const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const teacherProfileSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    employeeId: { type: String, required: true, trim: true, uppercase: true },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    dateOfBirth: { type: Date },
    cnic: { type: String, trim: true, default: '' },
    qualification: { type: String, trim: true, default: '' },
    specialization: { type: String, trim: true, default: '' },
    joiningDate: { type: Date, default: Date.now },
    address: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    employmentType: {
      type: String,
      enum: ['permanent', 'contract', 'partTime', 'visiting'],
      default: 'permanent',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

teacherProfileSchema.index({ schoolId: 1, employeeId: 1 }, { unique: true });
teacherProfileSchema.index(
  { schoolId: 1, cnic: 1 },
  { unique: true, partialFilterExpression: { cnic: { $type: 'string', $gt: '' } } }
);

module.exports = createTenantModel('TeacherProfile', teacherProfileSchema);
