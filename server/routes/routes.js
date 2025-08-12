const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  getRoutes,
  getRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  getRouteStats
} = require('../controllers/routeController');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Validation middleware
const createRouteValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Route name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('tripType')
    .isIn(['hiking', 'cycling'])
    .withMessage('Trip type must be either hiking or cycling'),
  body('location.country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('location.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('location.coordinates.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('location.coordinates.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('routeData.totalDistance')
    .isFloat({ min: 0 })
    .withMessage('Total distance must be a positive number'),
  body('routeData.totalDuration')
    .isFloat({ min: 0 })
    .withMessage('Total duration must be a positive number'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag must be less than 50 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
];

const updateRouteValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Route name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('tripType')
    .optional()
    .isIn(['hiking', 'cycling'])
    .withMessage('Trip type must be either hiking or cycling'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag must be less than 50 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
];

// Routes
router.get('/', getRoutes);
router.get('/:id', getRoute);
router.post('/', createRouteValidation, createRoute);
router.put('/:id', updateRouteValidation, updateRoute);
router.delete('/:id', deleteRoute);

module.exports = router; 