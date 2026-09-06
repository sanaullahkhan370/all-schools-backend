const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const examinationSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  termId: { type: mongoose.Schema.Types.ObjectId, ref: 'Term', required: true },
  name: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'active', 'completed', 'published'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
examinationSchema.index({ schoolId: 1, academicSessionId: 1, termId: 1, name: 1 }, { unique: true });
module.exports = createTenantModel('Examination', examinationSchema);
