import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService } from '../services/tripService';
import RouteMap from '../components/RouteMap';
import WeatherCard from '../components/WeatherCard';
import LoadingSpinner from '../components/LoadingSpinner';
import LocationSearch from '../components/LocationSearch';
import { MapPin, Compass, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const TripPlanner = () => {
  const [formData, setFormData] = useState({
    location: null, // { name, lat, lng }
    tripType: 'hiking',
    imageUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [imageData, setImageData] = useState(null);

  const navigate = useNavigate();

  // -------- Generate Route --------
  const generateRoute = async () => {
    if (!formData.location) {
      toast.error('Please select a location from the list');
      return;
    }
  
    // payload בסיסי עם נתונים נקיים
    const payload = {
      name: formData.location?.name || '',
      lat: Number(formData.location?.lat || 0),
      lng: Number(formData.location?.lng || 0),
    };
  
    console.log('Sending trip data to service:', {
      location: payload,
      tripType: formData.tripType,
    });
    console.log('Type of location:', typeof payload); // צריך להיות "object"
  
    // ניקוי סטייט
    setLoading(true);
    setRouteData(null);
    setWeatherData(null);
    setImageData(null);
  
    try {
      // שולח את האובייקט הנקי ל-tripService
      const result = await tripService.planTrip(
        {
          name: formData.location?.name || '',
          lat: Number(formData.location?.lat || 0),
          lng: Number(formData.location?.lng || 0),
        },
        formData.tripType
      );
      
      setRouteData(result.route || null);
      setWeatherData(result.weather || null);
      setImageData(result.image || null);
  
      toast.success('Route generated successfully!');
    } catch (error) {
      console.error('Route generation error:', error);
      toast.error('Failed to generate route. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  

  // -------- Save Route --------
  const saveRoute = async () => {
    if (!routeData) {
      toast.error('No route data to save');
      return;
    }

    try {
      const [cityPart, ...restParts] = (formData.location?.name || '').split(',');
      const city = cityPart?.trim() || 'Unknown';
      const country = restParts.pop()?.trim() || 'Unknown';

      const routeToSave = {
        name: `${city} ${formData.tripType} trip`,
        description: `Route in ${city}, ${country}`,
        tripType: formData.tripType,
        location: {
          country,
          city,
          coordinates: {
            lat: formData.location.lat,
            lng: formData.location.lng,
          },
        },
        routeData,
        weather: weatherData,
        image: imageData,
      };

      await tripService.createRoute(routeToSave);
      toast.success('Route saved successfully!');
      navigate('/routes');
    } catch (error) {
      console.error('Save route error:', error);
      toast.error('Failed to save route. Please try again.');
    }
  };

  // -------- Route Stats --------
  const getRouteStats = () => {
    if (!routeData) return null;

    return {
      totalDistance: routeData.totalDistance,
      totalDuration: routeData.totalDuration,
      totalElevation: routeData.totalElevation,
      dailyRoutes: routeData.dailyRoutes,
    };
  };

  const stats = getRouteStats();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-blue-600 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Plan Your Trip</h1>
        <p className="text-gray-600">
          Choose your destination and trip type to generate a personalized route
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Planning Form */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">Trip Details</h2>
            </div>
            <div className="card-body space-y-6">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Location
                </label>
                <LocationSearch
                  onSelect={(value) => setFormData((prev) => ({ ...prev, location: value }))}
                />
                {formData.location && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {formData.location.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="tripType" className="block text-sm font-medium text-gray-700 mb-2">
                  <Compass className="h-4 w-4 inline mr-1" />
                  Trip Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tripType"
                      value="hiking"
                      checked={formData.tripType === 'hiking'}
                      onChange={(e) => setFormData({ ...formData, tripType: e.target.value })}
                      className="mr-2"
                    />
                    <span className="text-sm">Hiking (5-15 km/day, circular routes)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tripType"
                      value="cycling"
                      checked={formData.tripType === 'cycling'}
                      onChange={(e) => setFormData({ ...formData, tripType: e.target.value })}
                      className="mr-2"
                    />
                    <span className="text-sm">Cycling (2-day route,max 60 km per day)</span>
                  </label>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={generateRoute}
                disabled={loading || !formData.location}
                className="w-full btn btn-primary"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner w-4 h-4 mr-2"></div>
                    Generating Route...
                  </div>
                ) : (
                  'Generate Route'
                )}
              </button>

              {/* Save Button */}
              <button
                onClick={saveRoute}
                disabled={!routeData}
                className="w-full btn btn-secondary mt-4"
              >
                Save Route
              </button>
            </div>
          </div>

          {/* Route Stats */}
          {stats && (
            <div className="card mt-6">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Route Summary</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.totalDistance.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">Total Distance (km)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(stats.totalDuration)}
                    </div>
                    <div className="text-sm text-gray-600">Duration (hours)</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {stats.dailyRoutes.map((day, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm font-medium">Day {day.day}</span>
                      <span className="text-sm text-gray-600">
                        {day.distance.toFixed(1)} km
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map and Weather */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <LoadingSpinner text="Generating route..." />
                </div>
              ) : routeData ? (
                <RouteMap
                  routeData={routeData}
                  height="500px"
                  showMarkers={true}
                  showRoute={true}
                />
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Select a location and generate a route to see it on the map</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {weatherData && (
            <WeatherCard weather={weatherData} location={{ name: formData.location.name }} />
          )}

          {imageData && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Destination Image</h3>
              </div>
              <div className="card-body">
                <img
                  src={imageData.url}
                  alt={imageData.alt}
                  className="w-full h-48 object-cover rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripPlanner;
