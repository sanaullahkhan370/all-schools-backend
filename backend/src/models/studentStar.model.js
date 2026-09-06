const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const studentStarSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherAssignment', required: true, index: true },
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', default: null, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true, index: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    category: {
      type: String,
      enum: ['conduct', 'cleanliness', 'punctuality', 'cooperation', 'responsibility', 'participation', 'homework'],
      required: true,
      index: true,
    },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500, default: '' },
    awardedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true }
);

studentStarSchema.index({ schoolId: 1, studentId: 1, awardedAt: -1 });
studentStarSchema.index({ schoolId: 1, teacherId: 1, awardedAt: -1 });
studentStarSchema.index(
  { homeworkId: 1, studentId: 1 },
  { unique: true, partialFilterExpression: { homeworkId: { $type: 'objectId' } } }
);

module.exports = createTenantModel('StudentStar', studentStarSchema);
