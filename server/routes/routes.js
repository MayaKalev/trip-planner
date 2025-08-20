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

// All routes require auth (JWT)
router.use(protect);

// Validation: create route
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
    .withMessage('Trip type must be hiking or cycling'),
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
    .withMessage('Distance must be positive'),
  body('routeData.totalDuration')
    .isFloat({ min: 0 })
    .withMessage('Duration must be positive'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag < 50 chars'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes < 1000 chars')
];

// Validation: update route
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
    .withMessage('Trip type must be hiking or cycling'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag < 50 chars'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes < 1000 chars')
];

// Routes
// GET /api/routes       – all routes
// GET /api/routes/:id   – single route
// POST /api/routes      – create
// PUT /api/routes/:id   – update
// DELETE /api/routes/:id – delete
router.get('/', getRoutes);
router.get('/:id', getRoute);
router.post('/', createRouteValidation, createRoute);
router.put('/:id', updateRouteValidation, updateRoute);
router.delete('/:id', deleteRoute);

module.exports = router;
