const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const teacherAssignmentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    assignmentRole: {
      type: String,
      enum: ['primary', 'assistant', 'substitute'],
      default: 'primary',
    },
    isActive: { type: Boolean, default: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deactivatedAt: { type: Date },
  },
  { timestamps: true }
);

teacherAssignmentSchema.index(
  { schoolId: 1, academicSessionId: 1, classId: 1, sectionId: 1, subjectId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, assignmentRole: 'primary' },
    name: 'one_active_primary_teacher_per_subject',
  }
);
teacherAssignmentSchema.index({ schoolId: 1, teacherId: 1, isActive: 1 });

module.exports = createTenantModel('TeacherAssignment', teacherAssignmentSchema);
