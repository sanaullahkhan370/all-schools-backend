const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const schoolClassSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
    name: { type: String, required: true, trim: true },
    displayOrder: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

schoolClassSchema.index({ schoolId: 1, academicSessionId: 1, name: 1 }, { unique: true });

module.exports = createTenantModel('SchoolClass', schoolClassSchema);
