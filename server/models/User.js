const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// -------------------- User Schema --------------------
const userSchema = new mongoose.Schema({
  // Username
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Max 50 characters']
  },

  // Email (used for login)
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,        // unique in DB
    lowercase: true,     // normalize
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },

  // Encrypted password
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'At least 6 chars'],
    select: false        // hide by default
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },

  // Last login date
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // auto createdAt + updatedAt
});

// Index by email
userSchema.index({ email: 1 });


// -------------------- Hooks --------------------
// Hash password before save (if modified)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// -------------------- Methods --------------------
// Compare entered password with hashed one
userSchema.methods.matchPassword = async function(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Return public profile (no password)
userSchema.methods.getPublicProfile = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// -------------------- Statics --------------------
// Find user by email (normalized)
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

module.exports = mongoose.model('User', userSchema);
