const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const examSubjectSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  examinationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Examination', required: true, index: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  assignedTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  examDate: { type: Date, required: true },
  maximumMarks: { type: Number, required: true, min: 1 },
  passingMarks: { type: Number, required: true, min: 0 },
  isLocked: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
examSubjectSchema.index({ examinationId: 1, classId: 1, sectionId: 1, subjectId: 1 }, { unique: true });
module.exports = createTenantModel('ExamSubject', examSubjectSchema);
