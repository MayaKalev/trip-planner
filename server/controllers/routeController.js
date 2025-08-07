const Route = require('../models/Route');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');

// @desc    Get all routes for current user
// @route   GET /api/routes
// @access  Private
const getRoutes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, tripType, status } = req.query;

  // Build filter object
  const filter = { user: req.user.id };
  if (tripType) filter.tripType = tripType;
  if (status) filter.status = status;

  const routes = await Route.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const count = await Route.countDocuments(filter);

  res.json({
    success: true,
    data: {
      routes: routes.map(route => route.getSummary()),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalRoutes: count,
        hasNextPage: page * limit < count,
        hasPrevPage: page > 1
      }
    }
  });
});

// @desc    Get single route
// @route   GET /api/routes/:id
// @access  Private
const getRoute = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id);

  if (!route) {
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }

  // Check if route belongs to user
  if (route.user.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  res.json({
    success: true,
    data: {
      route: route.getDetailed()
    }
  });
});

// @desc    Create new route
// @route   POST /api/routes
// @access  Private
const createRoute = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const {
    name,
    description,
    tripType,
    location,
    routeData,
    weather,
    image,
    tags,
    notes
  } = req.body;

  const route = await Route.create({
    user: req.user.id,
    name,
    description,
    tripType,
    location,
    routeData,
    weather,
    image,
    tags,
    notes
  });

  res.status(201).json({
    success: true,
    data: {
      route: route.getDetailed()
    },
    message: 'Route created successfully'
  });
});

// @desc    Update route
// @route   PUT /api/routes/:id
// @access  Private
const updateRoute = asyncHandler(async (req, res) => {
  let route = await Route.findById(req.params.id);

  if (!route) {
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }

  // Check if route belongs to user
  if (route.user.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this route'
    });
  }

  const {
    name,
    description,
    tripType,
    location,
    routeData,
    weather,
    image,
    status,
    tags,
    rating,
    notes
  } = req.body;

  // Update fields
  if (name !== undefined) route.name = name;
  if (description !== undefined) route.description = description;
  if (tripType !== undefined) route.tripType = tripType;
  if (location !== undefined) route.location = location;
  if (routeData !== undefined) route.routeData = routeData;
  if (weather !== undefined) route.weather = weather;
  if (image !== undefined) route.image = image;
  if (status !== undefined) route.status = status;
  if (tags !== undefined) route.tags = tags;
  if (rating !== undefined) route.rating = rating;
  if (notes !== undefined) route.notes = notes;

  const updatedRoute = await route.save();

  res.json({
    success: true,
    data: {
      route: updatedRoute.getDetailed()
    },
    message: 'Route updated successfully'
  });
});

// @desc    Delete route
// @route   DELETE /api/routes/:id
// @access  Private
const deleteRoute = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id);

  if (!route) {
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }

  // Check if route belongs to user
  if (route.user.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this route'
    });
  }

  await route.remove();

  res.json({
    success: true,
    message: 'Route deleted successfully'
  });
});

// @desc    Get route statistics
// @route   GET /api/routes/stats
// @access  Private
const getRouteStats = asyncHandler(async (req, res) => {
  const stats = await Route.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: null,
        totalRoutes: { $sum: 1 },
        totalDistance: { $sum: '$routeData.totalDistance' },
        totalDuration: { $sum: '$routeData.totalDuration' },
        hikingRoutes: {
          $sum: { $cond: [{ $eq: ['$tripType', 'hiking'] }, 1, 0] }
        },
        cyclingRoutes: {
          $sum: { $cond: [{ $eq: ['$tripType', 'cycling'] }, 1, 0] }
        },
        completedRoutes: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        plannedRoutes: {
          $sum: { $cond: [{ $eq: ['$status', 'planned'] }, 1, 0] }
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalRoutes: 0,
    totalDistance: 0,
    totalDuration: 0,
    hikingRoutes: 0,
    cyclingRoutes: 0,
    completedRoutes: 0,
    plannedRoutes: 0
  };

  res.json({
    success: true,
    data: {
      stats: {
        ...result,
        averageDistance: result.totalRoutes > 0 ? result.totalDistance / result.totalRoutes : 0,
        averageDuration: result.totalRoutes > 0 ? result.totalDuration / result.totalRoutes : 0
      }
    }
  });
});

module.exports = {
  getRoutes,
  getRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  getRouteStats
}; 