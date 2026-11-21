const express = require('express');

const {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} = require('../controllers/note.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.use(authenticate);

router.route('/').get(asyncHandler(listNotes)).post(asyncHandler(createNote));
router
  .route('/:id')
  .get(asyncHandler(getNote))
  .patch(asyncHandler(updateNote))
  .delete(asyncHandler(deleteNote));

module.exports = router;
