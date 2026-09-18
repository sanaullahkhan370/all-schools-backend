const express = require('express');
const controller = require('../controllers/student.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();
router.use(protect, authorize('admin'));

router.route('/').get(controller.listStudents).post(controller.createStudent);
router.route('/:id')
  .get(controller.getStudent)
  .patch(controller.updateStudent)
  .delete(controller.deleteStudent);
router.patch('/:id/status', controller.changeStudentStatus);
router.patch('/:id/enrollment', controller.changeEnrollment);
router.post('/:id/parents', controller.linkParent);
router.delete('/:id/parents/:linkId', controller.unlinkParent);
router.post('/:id/cards', controller.generateStudentCard);

module.exports = router;
