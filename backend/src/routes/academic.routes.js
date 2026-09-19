const express = require('express');
const controller = require('../controllers/academic.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();
router.use(protect, authorize('admin'));

router.route('/sessions').get(controller.listSessions).post(controller.createSession);
router.route('/sessions/:id')
  .patch(controller.updateSession)
  .delete(controller.deleteSession);
router.patch('/sessions/:id/current', controller.setCurrentSession);

router.route('/terms').get(controller.listTerms).post(controller.createTerm);
router.route('/terms/:id')
  .patch(controller.updateTerm)
  .delete(controller.deleteTerm);
router.route('/classes').get(controller.listClasses).post(controller.createClass);
router.route('/sections').get(controller.listSections).post(controller.createSection);
router.route('/sections/:id').patch(controller.updateSection).delete(controller.deleteSection);
router.route('/subjects').get(controller.listSubjects).post(controller.createSubject);
router.route('/subjects/:id').patch(controller.updateSubject).delete(controller.deleteSubject);
router.route('/teacher-assignments')
  .get(controller.listTeacherAssignments)
  .post(controller.createTeacherAssignment);
router.route('/teacher-assignments/:id')
  .patch(controller.updateTeacherAssignment)
  .delete(controller.deleteTeacherAssignment);
router.patch('/teacher-assignments/:id/deactivate', controller.deactivateTeacherAssignment);

module.exports = router;
