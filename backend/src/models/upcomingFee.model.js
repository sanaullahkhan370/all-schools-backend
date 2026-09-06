const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const upcomingFeeSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', default: null, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    feeType: {
      type: String,
      enum: ['tuition', 'examination', 'test', 'books', 'copies', 'planner', 'assignment', 'transport', 'computer', 'other'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    expectedDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['planned', 'invoiced', 'cancelled'], default: 'planned', index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

upcomingFeeSchema.index({ schoolId: 1, status: 1, expectedDate: 1 });

module.exports = createTenantModel('UpcomingFee', upcomingFeeSchema);
