const express = require('express');
const {
  createTeacher,
  createParent,
  listParents,
  updateParent,
  deleteParent,
  getSchoolUsers,
  getDashboardStats,
} = require('../controllers/admin.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

// Tamam routes Admin ke liye secure hain
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.post('/teachers', createTeacher);
router.route('/parents')
  .get(listParents)
  .post(createParent);
router.route('/parents/:id')
  .patch(updateParent)
  .delete(deleteParent);
router.get('/users', getSchoolUsers);

module.exports = router;
