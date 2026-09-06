const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const attendanceCorrectionSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  attendanceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceRecord', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  oldStatus: { type: String, required: true },
  newStatus: { type: String, required: true },
  reason: { type: String, required: true, trim: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
module.exports = createTenantModel('AttendanceCorrection', attendanceCorrectionSchema);
