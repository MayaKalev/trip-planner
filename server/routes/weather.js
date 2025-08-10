const express = require('express');
const { getWeatherData } = require('../controllers/weatherController');

const router = express.Router();

// Routes
router.get('/:location', getWeatherData);

module.exports = router; 