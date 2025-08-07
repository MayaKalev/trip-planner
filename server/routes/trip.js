const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { planTrip } = require('../controllers/tripController');

const router = express.Router();

// Validation middleware
const planTripValidation = [
  body('location')
    .custom((value) => {
      console.log('📥 Raw location received:', value);
      if (
        typeof value !== 'object' ||
        !value.name ||
        typeof value.lat !== 'number' ||
        typeof value.lng !== 'number'
      ) {
        throw new Error('Location must be a valid object with name, lat, and lng');
      }
      return true;
    }),
  body('tripType')
    .isIn(['hiking', 'cycling'])
    .withMessage('Trip type must be either hiking or cycling')
];


// Routes
router.post('/plan', protect, planTripValidation, planTrip);

module.exports = router;
