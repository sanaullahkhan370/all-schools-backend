const express = require('express');
const controller = require('../controllers/teacherManagement.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();
router.use(protect, authorize('admin'));

router.route('/').get(controller.listTeachers).post(controller.createTeacher);
router.route('/:id')
  .get(controller.getTeacher)
  .patch(controller.updateTeacher)
  .delete(controller.deleteTeacher);
router.patch('/:id/status', controller.changeTeacherStatus);

module.exports = router;
