const express = require('express');

const { createPost } = require('../controllers/post.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/', authenticate, asyncHandler(createPost));

module.exports = router;
