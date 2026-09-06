const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const feeStructureSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass' },
  title: { type: String, required: true, trim: true },
  feeType: { type: String, enum: ['admission', 'tuition', 'examination', 'test', 'books', 'copies', 'planner', 'assignment', 'transport', 'computer', 'other'], required: true },
  amount: { type: Number, required: true, min: 0 },
  frequency: { type: String, enum: ['oneTime', 'monthly', 'termWise', 'annual', 'custom'], default: 'monthly' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
feeStructureSchema.index({ schoolId: 1, academicSessionId: 1, classId: 1, title: 1 }, { unique: true });
module.exports = createTenantModel('FeeStructure', feeStructureSchema);
