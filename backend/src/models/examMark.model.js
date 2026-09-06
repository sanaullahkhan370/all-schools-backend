const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const examMarkSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  examSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSubject', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  obtainedMarks: { type: Number, min: 0 },
  attendanceStatus: { type: String, enum: ['present', 'absent', 'exempted', 'resultWithheld'], default: 'present' },
  remarks: { type: String, trim: true, default: '' },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
examMarkSchema.index({ examSubjectId: 1, studentId: 1 }, { unique: true });
module.exports = createTenantModel('ExamMark', examMarkSchema);
