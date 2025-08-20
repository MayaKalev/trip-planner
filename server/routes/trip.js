const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { planTrip } = require('../controllers/tripController');

const router = express.Router();

// Validation for trip planning request
const planTripValidation = [
  body('location')
    .custom((value) => {
      if (
        typeof value !== 'object' ||
        !value.name ||
        typeof value.lat !== 'number' ||
        typeof value.lng !== 'number'
      ) {
        // Invalid location format
        throw new Error('Location must be an object with name, lat, and lng');
      }
      return true;
    }),
  body('tripType')
    .isIn(['hiking', 'cycling'])
    .withMessage('Trip type must be hiking or cycling')
];

// POST /api/trip/plan (protected + validation)
router.post('/plan', protect, planTripValidation, planTrip);

module.exports = router;
