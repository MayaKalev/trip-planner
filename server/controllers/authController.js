const User = require('../models/User');
const { generateToken } = require('../middleware/auth'); // Function that generates JWT
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');

// Register a new user – includes validation, unique email check, save, and return JWT
const register = asyncHandler(async (req, res) => {
  // Check validation results defined in the router
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password } = req.body;

  // Check if a user with the same email already exists
  const userExists = await User.findByEmail(email);
  if (userExists) {
    return res.status(400).json({ success: false, message: 'User already exists with this email' });
  }

  // Create a new user in the database
  const user = await User.create({ name, email, password });
  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid user data' });
  }

  // Generate JWT token for further authentication
  const token = generateToken(user._id);
  res.status(201).json({
    success: true,
    data: { user: user.getPublicProfile(), token }, // Return public profile only
    message: 'User registered successfully'
  });
});

// User login – includes password check, user status check, and return JWT
const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;
  // Load the password field as well for comparison
  const user = await User.findByEmail(email).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // Do not allow login if the account is deactivated
  if (!user.isActive) {
    return res.status(401).json({ success: false, message: 'Account is deactivated' });
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // Update last login date
  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);
  res.json({
    success: true,
    data: { user: user.getPublicProfile(), token },
    message: 'Login successful'
  });
});

// Return details of the authenticated user (based on user.id from the token)
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, data: { user: user.getPublicProfile() } });
});

// Update profile – allows changing name and email only, includes check if new email is available
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }

  if (typeof email === 'string' && email.trim()) {
    const existingUser = await User.findByEmail(email.trim());
    // Make sure the new email is not already used by another user
    if (existingUser && existingUser._id.toString() !== req.user.id) {
      return res.status(400).json({ success: false, message: 'Email is already taken' });
    }
    user.email = email.trim();
  }

  const updatedUser = await user.save();
  res.json({
    success: true,
    data: { user: updatedUser.getPublicProfile() },
    message: 'Profile updated successfully'
  });
});

// Change password – requires the current password for verification
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Load password from the database for comparison
  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Check that the current password is correct
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  // Save the new password
  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully' });
});

module.exports = { register, login, getMe, updateProfile, changePassword };
