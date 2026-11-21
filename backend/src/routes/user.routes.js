const express = require('express');

const {
  getMe,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  usersGroupedByInterests,
} = require('../controllers/user.controller');
const { listPostsByUser } = require('../controllers/post.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
const adminOnly = [authenticate, requireRole('admin')];

// Any authenticated user
router.get('/me', authenticate, asyncHandler(getMe));
router.get('/:id/posts', authenticate, asyncHandler(listPostsByUser));

// Admin only
router.get('/grouped-by-interests', adminOnly, asyncHandler(usersGroupedByInterests));
router.get('/', adminOnly, asyncHandler(listUsers));
router.post('/', adminOnly, asyncHandler(createUser));
router.patch('/:id', adminOnly, asyncHandler(updateUser));
router.delete('/:id', adminOnly, asyncHandler(deleteUser));

module.exports = router;
