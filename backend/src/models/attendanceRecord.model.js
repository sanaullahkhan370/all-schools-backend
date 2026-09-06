const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const attendanceRecordSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  attendanceSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  status: { type: String, enum: ['notMarked', 'present', 'absent', 'leave', 'late'], default: 'notMarked' },
  source: { type: String, enum: ['manual', 'cardScan', 'adminCorrection'], required: true },
  scanTime: Date,
  remarks: { type: String, trim: true, default: '' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

attendanceRecordSchema.index({ attendanceSessionId: 1, studentId: 1 }, { unique: true });
module.exports = createTenantModel('AttendanceRecord', attendanceRecordSchema);
