const express = require('express');
const {
  uploadHomeworkAttachment,
  downloadHomeworkAttachment,
  getTeacherHomework,
  createHomework,
  updateHomework,
  deleteHomework,
  getParentHomework,
  getHomeworkMarkSheet,
  saveHomeworkMarks,
  getAdminHomeworkMarks,
  saveParentHomeworkResponse,
  getTeacherHomeworkResponses,
  getAdminHomeworkResponses,
} = require('../controllers/homework.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.get('/attachments/:fileId', downloadHomeworkAttachment);
router.use(protect);
router.post('/attachments', authorize('teacher'), uploadHomeworkAttachment);

router.get('/teacher', authorize('teacher'), getTeacherHomework);
router.get('/teacher/responses', authorize('teacher'), getTeacherHomeworkResponses);
router.get('/admin/marks', authorize('admin', 'superAdmin'), getAdminHomeworkMarks);
router.get('/admin/responses', authorize('admin', 'superAdmin'), getAdminHomeworkResponses);
router.get('/:id/mark-sheet', authorize('teacher'), getHomeworkMarkSheet);
router.put('/:id/marks', authorize('teacher'), saveHomeworkMarks);
router.post('/', authorize('teacher'), createHomework);
router.patch('/:id', authorize('teacher'), updateHomework);
router.delete('/:id', authorize('teacher'), deleteHomework);
router.get('/parent', authorize('parent'), getParentHomework);
router.put('/:id/parent-response', authorize('parent'), saveParentHomeworkResponse);

module.exports = router;
