const Route = require('../models/Route');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const normalizeRouteData = require('./normalizeRouteData');
const mongoose = require('mongoose');


//   GET /api/routes
const getRoutes = asyncHandler(async (req, res) => {
  // Page/limit params – convert to numbers with defaults
  const pageNum = Number(req.query.page || 1);
  const limitNum = Number(req.query.limit || 10);
  const { tripType } = req.query;

  // Filter by logged-in user; optionally by tripType
  const filter = { user: req.user.id };
  if (tripType) filter.tripType = tripType;

  // Paginated query + sort newest first
  const routes = await Route.find(filter)
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum)
    .exec();

  const count = await Route.countDocuments(filter);

  // Return only summary for each route to reduce response size
  res.json({
    success: true,
    data: {
      routes: routes.map(route => route.getSummary()),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(count / limitNum),
        totalRoutes: count,
        hasNextPage: pageNum * limitNum < count,
        hasPrevPage: pageNum > 1
      }
    }
  });
});


//   GET /api/routes/:id
const getRoute = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id);
  if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

  // Protect from accessing another user's data
  if (route.user.toString() !== req.user.id)
    return res.status(403).json({ success: false, message: 'Not authorized to access this route' });

  // Normalize routeData to consistent format + compute center for frontend
  const { routeData: normalizedRD, center } = normalizeRouteData(route.routeData, route.location);

  const detailed = route.getDetailed();
  detailed.routeData = normalizedRD;
  detailed.center = center;

  res.json({ success: true, data: { route: detailed } });
});


//   POST /api/routes
const createRoute = asyncHandler(async (req, res) => {
  // Validate request using express-validator (if defined in router)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const {
    name,
    description,
    tripType,
    location,
    routeData,
    // weather, ← intentionally ignored/not stored
    image,
    tags,
    notes
  } = req.body;

  // Normalize routeData before saving to DB – ensures consistent structure
  const { routeData: normalizedRD } = normalizeRouteData(routeData, location);

  const route = await Route.create({
    user: req.user.id,
    name,
    description,
    tripType,
    location,
    routeData: normalizedRD,
    // weather, ← not stored in DB
    image,
    tags,
    notes
  });

  res.status(201).json({
    success: true,
    data: { route: route.getDetailed() },
    message: 'Route created successfully'
  });
});


// PUT /api/routes/:id

const updateRoute = asyncHandler(async (req, res) => {
  let route = await Route.findById(req.params.id);

  if (!route) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }

  // Prevent updating a route that does not belong to the user
  if (route.user.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this route' });
  }

  const {
    name,
    description,
    tripType,
    location,
    routeData,
    // weather, ← intentionally not updated
    image,
    tags,
    notes
  } = req.body;

  // Partial updates – only touch fields that were provided
  if (name !== undefined) route.name = name;
  if (description !== undefined) route.description = description;
  if (tripType !== undefined) route.tripType = tripType;
  // if (weather !== undefined) route.weather = weather; ← not updating weather
  if (image !== undefined) route.image = image;
  if (tags !== undefined) route.tags = tags;
  if (notes !== undefined) route.notes = notes;

  // If location updated – save it and use for normalizing new routeData
  const nextLocation = location !== undefined ? location : route.location;
  if (location !== undefined) route.location = location;

  // Normalize routeData only if provided
  if (routeData !== undefined) {
    const { routeData: normalizedRD } = normalizeRouteData(routeData, nextLocation);
    route.routeData = normalizedRD;
  }

  const updatedRoute = await route.save();

  res.json({
    success: true,
    data: { route: updatedRoute.getDetailed() },
    message: 'Route updated successfully'
  });
});




// DELETE /api/routes/:id
const deleteRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Early validation for invalid ObjectId – avoids unnecessary DB queries
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid route id' });
  }

  // Delete only if route belongs to the user – double protection (request + DB)
  const deleted = await Route.findOneAndDelete({ _id: id, user: req.user.id });

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }

  return res.json({ success: true, message: 'Route deleted successfully' });
});

module.exports = {
  getRoutes,
  getRoute,
  createRoute,
  updateRoute,
  deleteRoute,
};
