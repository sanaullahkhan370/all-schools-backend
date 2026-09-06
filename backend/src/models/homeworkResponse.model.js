const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const homeworkResponseSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    responseStatus: {
      type: String,
      enum: ['seen', 'completed', 'needsHelp'],
      required: true,
      index: true,
    },
    message: { type: String, trim: true, maxlength: 800, default: '' },
    respondedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true }
);

homeworkResponseSchema.index(
  { homeworkId: 1, studentId: 1, parentId: 1 },
  { unique: true }
);
homeworkResponseSchema.index({ schoolId: 1, teacherId: 1, respondedAt: -1 });

module.exports = createTenantModel('HomeworkResponse', homeworkResponseSchema);
