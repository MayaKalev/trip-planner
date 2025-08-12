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
    country: { type: String, required: true, trim: true },
    region: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  routeData: {
    geometry: {
      type: { type: String, enum: ['LineString'] },
      coordinates: { type: [[Number]] }
    },
    center: { type: [Number], default: undefined },
    points: [{
      lat: Number,
      lng: Number,
      day: Number,
      order: Number
    }],
    dailyRoutes: [{
      day: Number,
      distance: Number, // km
      duration: Number, // hours
      points: [{ lat: Number, lng: Number, order: Number }]
    }],
    totalDistance: { type: Number, required: true, min: 0 }, // km
    totalDuration: { type: Number, required: true, min: 0 }, // hours
    
  },
  weather: {
    forecast: [{
      date: Date,
      temperature: { min: Number, max: Number, current: Number },
      description: String,
      icon: String,
      humidity: Number,
      windSpeed: Number,
      precipitation: Number
    }]
  },
  image: { url: String, alt: String },
  tags: [{ type: String, trim: true }],
  rating: { type: Number, min: 1, max: 5, default: null },
  notes: { type: String, trim: true, maxlength: [1000, 'Notes cannot be more than 1000 characters'] }
}, { timestamps: true });

// Indexes
routeSchema.index({ user: 1, createdAt: -1 });
routeSchema.index({ tripType: 1 });
routeSchema.index({ 'location.country': 1, 'location.city': 1 });
routeSchema.index({ 'routeData.geometry': '2dsphere' });

// Virtuals
routeSchema.virtual('formattedDistance').get(function () {
  const km = this.routeData?.totalDistance || 0;
  return `${km.toFixed(1)} km`;
});

routeSchema.virtual('formattedDuration').get(function () {
  const h = this.routeData?.totalDuration || 0;
  return `${Math.round(h)} h`;
});

// Methods
routeSchema.methods.getSummary = function () {
  const d = this.toObject();
  return {
    id: d._id,
    name: d.name,
    description: d.description,
    tripType: d.tripType,
    location: d.location,
    formattedDistance: `${(d.routeData?.totalDistance || 0).toFixed(1)} km`,
    formattedDuration: `${Math.round(d.routeData?.totalDuration || 0)} h`,
    image: d.image,
    createdAt: d.createdAt,
    weather: d.weather
  };
};

routeSchema.methods.getDetailed = function () {
  const d = this.toObject();
  return {
    id: d._id,
    name: d.name,
    description: d.description,
    tripType: d.tripType,
    location: d.location,
    routeData: d.routeData,
    totalDistance: d.routeData?.totalDistance || 0,
    totalDuration: d.routeData?.totalDuration || 0,
    formattedDistance: `${(d.routeData?.totalDistance || 0).toFixed(1)} km`,
    formattedDuration: `${Math.round(d.routeData?.totalDuration || 0)} h`,
    weather: d.weather,
    image: d.image,
    tags: d.tags,
    notes: d.notes,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  };
};

routeSchema.set('toJSON', { virtuals: true });
routeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Route', routeSchema);
