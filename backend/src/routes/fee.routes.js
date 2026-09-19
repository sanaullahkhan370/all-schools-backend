const express = require('express');
const controller = require('../controllers/fee.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const router = express.Router();
router.use(protect);
router.get('/status', authorize('parent'), controller.getParentFeeStatus);
router.get('/parent/status', authorize('parent'), controller.getParentFeeStatus);
router.route('/upcoming')
  .get(authorize('admin'), controller.listUpcomingFees)
  .post(authorize('admin'), controller.createUpcomingFee);
router.route('/structures')
  .get(authorize('admin'), controller.listStructures)
  .post(authorize('admin'), controller.createStructure);
router.post('/invoices/bulk', authorize('admin'), controller.createBulkInvoices);
router.route('/invoices')
  .get(authorize('admin'), controller.listInvoices)
  .post(authorize('admin'), controller.createInvoice);
router.post(
  '/invoices/:invoiceId/payments',
  authorize('admin'),
  controller.recordPayment
);
router.get('/payments', authorize('admin'), controller.listPayments);
module.exports = router;
