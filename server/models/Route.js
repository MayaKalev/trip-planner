const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Route name is required'],
    trim: true,
    maxlength: [100, 'Route name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  tripType: {
    type: String,
    enum: ['hiking', 'cycling'],
    required: [true, 'Trip type is required']
  },
  location: {
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true
    },
    region: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    coordinates: {
      lat: {
        type: Number,
        required: [true, 'Latitude is required']
      },
      lng: {
        type: Number,
        required: [true, 'Longitude is required']
      }
    }
  },
  routeData: {
    // Array of route points for the entire trip
    points: [{
      lat: Number,
      lng: Number,
      day: Number, // Which day of the trip
      order: Number // Order within the day
    }],
    // Daily route segments
    dailyRoutes: [{
      day: Number,
      distance: Number, // in kilometers
      duration: Number, // estimated duration in hours
      elevation: {
        gain: Number,
        loss: Number
      },
      points: [{
        lat: Number,
        lng: Number,
        order: Number
      }]
    }],
    totalDistance: {
      type: Number,
      required: true
    },
    totalDuration: {
      type: Number,
      required: true
    },
    totalElevation: {
      gain: Number,
      loss: Number
    }
  },
  weather: {
    // Weather data for the trip start date and next 2 days
    forecast: [{
      date: Date,
      temperature: {
        min: Number,
        max: Number,
        current: Number
      },
      description: String,
      icon: String,
      humidity: Number,
      windSpeed: Number,
      precipitation: Number
    }]
  },
  image: {
    url: String,
    alt: String
  },
  status: {
    type: String,
    enum: ['planned', 'completed', 'cancelled'],
    default: 'planned'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
routeSchema.index({ user: 1, createdAt: -1 });
routeSchema.index({ tripType: 1 });
routeSchema.index({ 'location.country': 1, 'location.city': 1 });
routeSchema.index({ status: 1 });

// Virtual for formatted duration
routeSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.routeData.totalDuration);
  const minutes = Math.round((this.routeData.totalDuration - hours) * 60);
  return `${hours}h ${minutes}m`;
});

// Virtual for formatted distance
routeSchema.virtual('formattedDistance').get(function() {
  return `${this.routeData.totalDistance.toFixed(1)} km`;
});

// Method to get route summary
routeSchema.methods.getSummary = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    tripType: this.tripType,
    location: this.location,
    totalDistance: this.routeData.totalDistance,
    totalDuration: this.routeData.totalDuration,
    formattedDuration: this.formattedDuration,
    formattedDistance: this.formattedDistance,
    image: this.image,
    status: this.status,
    createdAt: this.createdAt,
    weather: this.weather
  };
};

// Method to get detailed route data
routeSchema.methods.getDetailed = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    tripType: this.tripType,
    location: this.location,
    routeData: this.routeData,
    weather: this.weather,
    image: this.image,
    status: this.status,
    tags: this.tags,
    rating: this.rating,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Ensure virtuals are included when converting to JSON
routeSchema.set('toJSON', { virtuals: true });
routeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Route', routeSchema); 