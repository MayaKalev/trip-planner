const express = require('express');
const { getWeatherForecast, getCurrentWeather } = require('../controllers/weatherController');

const router = express.Router();

// Routes
router.get('/:location', getWeatherForecast);
router.get('/:location/current', getCurrentWeather);

module.exports = router; 