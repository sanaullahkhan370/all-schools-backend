const mongoose = require('mongoose');
const { createTenantModel } = require('../config/tenantModels');

const feeInvoiceSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true, uppercase: true },
  items: [{ title: String, feeType: String, amount: { type: Number, min: 0 } }],
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  fine: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  remainingAmount: { type: Number, required: true, min: 0 },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['unpaid', 'partiallyPaid', 'paid', 'overdue', 'cancelled'], default: 'unpaid' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
feeInvoiceSchema.index({ schoolId: 1, studentId: 1, status: 1 });
module.exports = createTenantModel('FeeInvoice', feeInvoiceSchema);
