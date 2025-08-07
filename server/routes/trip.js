const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { planTrip } = require('../controllers/tripController');

const router = express.Router();

// Validation middleware
const planTripValidation = [
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required'),
  body('tripType')
    .isIn(['hiking', 'cycling'])
    .withMessage('Trip type must be either hiking or cycling')
];

// Routes
router.post('/plan', protect, planTripValidation, planTrip);

module.exports = router;
