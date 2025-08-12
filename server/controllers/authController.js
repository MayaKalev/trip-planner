const User = require('../models/User');
const { generateToken } = require('../middleware/auth'); // ודאי שקיים/מיובא נכון
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password } = req.body;

  const userExists = await User.findByEmail(email);
  if (userExists) {
    return res.status(400).json({ success: false, message: 'User already exists with this email' });
  }

  const user = await User.create({ name, email, password });
  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid user data' });
  }

  const token = generateToken(user._id);
  res.status(201).json({
    success: true,
    data: { user: user.getPublicProfile(), token },
    message: 'User registered successfully'
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;
  const user = await User.findByEmail(email).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return res.status(401).json({ success: false, message: 'Account is deactivated' });
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);
  res.json({
    success: true,
    data: { user: user.getPublicProfile(), token },
    message: 'Login successful'
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, data: { user: user.getPublicProfile() } });
});

// @desc    Update user profile (name & email only)
// @route   PUT /api/auth/profile
// @access  Private
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

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully' });
});

module.exports = { register, login, getMe, updateProfile, changePassword };
