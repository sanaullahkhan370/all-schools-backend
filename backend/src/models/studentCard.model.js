const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const studentCardSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    cardCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revokedAt: { type: Date },
    revokeReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

studentCardSchema.index(
  { schoolId: 1, studentId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

module.exports = createTenantModel('StudentCard', studentCardSchema);
