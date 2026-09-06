const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const homeworkSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherAssignment', required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    assignedDate: { type: Date, required: true, default: Date.now, index: true },
    dueDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'published', index: true },
    attachmentUrl: { type: String, trim: true, default: '' },
    maximumMarks: { type: Number, required: true, min: 1, max: 100, default: 10 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

homeworkSchema.index({ schoolId: 1, classId: 1, sectionId: 1, assignedDate: -1 });
homeworkSchema.index({ schoolId: 1, teacherId: 1, assignedDate: -1 });

module.exports = createTenantModel('Homework', homeworkSchema);
