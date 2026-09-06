const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const homeworkMarkSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    obtainedMarks: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true, maxlength: 500, default: '' },
    checkedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

homeworkMarkSchema.index({ homeworkId: 1, studentId: 1 }, { unique: true });
homeworkMarkSchema.index({ schoolId: 1, studentId: 1, checkedAt: -1 });

module.exports = createTenantModel('HomeworkMark', homeworkMarkSchema);
