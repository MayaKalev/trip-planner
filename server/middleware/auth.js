const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes – check login + token
const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find user by ID (no password)
      req.user = await User.findById(decoded.id).select('-password');

      // User not found
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      // Account inactive
      if (!req.user.isActive) {
        return res.status(401).json({ success: false, message: 'Account deactivated' });
      }

      // Continue
      next();
    } catch (error) {
      // Token invalid/expired
      return res.status(401).json({ success: false, message: 'Token failed' });
    }
  }

  // No token
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token' });
  }
};

// Generate JWT for user
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Optional auth – set user if token valid, else ignore
const optionalAuth = async (req, res, next) => {
  let token;

  // Check for Bearer token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Set user (no password)
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Ignore errors
    }
  }

  // Always continue
  next();
};

module.exports = {
  protect,
  generateToken,
  optionalAuth
};
