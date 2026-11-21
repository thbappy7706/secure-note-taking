const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const noteRoutes = require('./note.routes');
const postRoutes = require('./post.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/notes', noteRoutes);
router.use('/posts', postRoutes);

module.exports = router;
