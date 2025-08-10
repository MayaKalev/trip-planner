// routes/image.js
const express = require('express');
const router = express.Router();
const { getImageByLocation } = require('../controllers/imageController');

router.get('/', getImageByLocation); // GET /api/image?location=Berlin

module.exports = router;
