const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const studentEnrollmentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    rollNumber: { type: String, required: true, trim: true, uppercase: true },
    enrollmentDate: { type: Date, default: Date.now },
    isCurrent: { type: Boolean, default: true, index: true },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

studentEnrollmentSchema.index(
  { schoolId: 1, academicSessionId: 1, classId: 1, sectionId: 1, rollNumber: 1 },
  { unique: true }
);
studentEnrollmentSchema.index(
  { schoolId: 1, studentId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);

module.exports = createTenantModel('StudentEnrollment', studentEnrollmentSchema);
