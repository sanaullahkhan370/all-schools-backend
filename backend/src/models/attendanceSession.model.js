const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const attendanceSessionSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'submitted', 'locked'], default: 'draft' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: Date,
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lockedAt: Date,
}, { timestamps: true });

attendanceSessionSchema.index({ schoolId: 1, classId: 1, sectionId: 1, date: 1 }, { unique: true });
module.exports = createTenantModel('AttendanceSession', attendanceSessionSchema);
