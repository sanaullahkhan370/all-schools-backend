const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const questionMarkSchema = new mongoose.Schema({
  questionNumber: { type: String, required: true, trim: true },
  obtainedMarks: { type: Number, required: true, min: 0 },
}, { _id: false });

const examAnswerSheetSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  examSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSubject', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentEnrollment', required: true },
  sheetNumber: { type: String, required: true, trim: true, uppercase: true },
  studentCardCode: { type: String, required: true, trim: true, uppercase: true },
  rollNumber: { type: String, required: true, trim: true },
  attendanceStatus: { type: String, enum: ['present'], default: 'present' },
  questionMarks: { type: [questionMarkSchema], default: [] },
  totalObtained: { type: Number, min: 0 },
  status: { type: String, enum: ['allocated', 'submitted'], default: 'allocated' },
  scannedAt: { type: Date, default: Date.now },
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: { type: String, trim: true, default: '' },
}, { timestamps: true });

examAnswerSheetSchema.index({ examSubjectId: 1, studentId: 1 }, { unique: true });
examAnswerSheetSchema.index({ schoolId: 1, sheetNumber: 1 }, { unique: true });

module.exports = createTenantModel('ExamAnswerSheet', examAnswerSheetSchema);
