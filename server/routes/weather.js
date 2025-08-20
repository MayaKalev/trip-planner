// server/routes/weather.js
const express = require('express');
const { getWeatherData } = require('../controllers/weatherController');
const { protect } = require('../middleware/auth'); // Middleware that ensures the user is authenticated (JWT)
const router = express.Router();

/**
 * API route — get a 3-day weather forecast by coordinates.
 * The path takes two dynamic params: lat and lng.
 * Example: GET /api/weather/32.0853/34.7818
 */
router.get('/:lat/:lng', protect, async (req, res, next) => {
  try {
    // Convert params to numbers to ensure we can work with them
    const lat = Number(req.params.lat);
    const lng = Number(req.params.lng);

    // Validation — if the coordinates are invalid, return a 400 error
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. lat and lng must be numbers',
      });
    }

    // Call the logic function that fetches the latest forecast from the OpenWeatherMap API
    const data = await getWeatherData(lat, lng);

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;