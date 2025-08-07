import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { routeService } from '../services/routeService';
import RouteMap from '../components/RouteMap';
import WeatherCard from '../components/WeatherCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { MapPin, Calendar, Clock, Trash2, Eye, Filter, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const SavedRoutes = () => {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    tripType: '',
    status: ''
  });

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await routeService.getRoutes();
      setRoutes(response.routes);
    } catch (error) {
      console.error('Error fetching routes:', error);
      toast.error('Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm('Are you sure you want to delete this route?')) {
      return;
    }

    try {
      await routeService.deleteRoute(routeId);
      setRoutes(routes.filter(route => route.id !== routeId));
      if (selectedRoute?.id === routeId) {
        setSelectedRoute(null);
      }
      toast.success('Route deleted successfully');
    } catch (error) {
      console.error('Error deleting route:', error);
      toast.error('Failed to delete route');
    }
  };

  const filteredRoutes = routes.filter(route => {
    if (filter.tripType && route.tripType !== filter.tripType) return false;
    if (filter.status && route.status !== filter.status) return false;
    return true;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTripTypeIcon = (tripType) => {
    return tripType === 'hiking' ? '🥾' : '🚴';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading your routes..." />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Routes</h1>
            <p className="text-gray-600">
              View and manage your saved trip routes
            </p>
          </div>
          <Link
            to="/plan"
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Plan New Trip
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Routes List */}
        <div className="lg:col-span-1">
          {/* Filters */}
          <div className="card mb-6">
            <div className="card-header">
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              </div>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trip Type
                </label>
                <select
                  value={filter.tripType}
                  onChange={(e) => setFilter(prev => ({ ...prev, tripType: e.target.value }))}
                  className="input"
                >
                  <option value="">All Types</option>
                  <option value="hiking">Hiking</option>
                  <option value="cycling">Cycling</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filter.status}
                  onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
                  className="input"
                >
                  <option value="">All Status</option>
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Routes List */}
          <div className="space-y-4">
            {filteredRoutes.length === 0 ? (
              <div className="card">
                <div className="card-body text-center py-8">
                  <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No routes found</h3>
                  <p className="text-gray-600 mb-4">
                    {routes.length === 0 
                      ? "You haven't saved any routes yet."
                      : "No routes match your current filters."
                    }
                  </p>
                  {routes.length === 0 && (
                    <Link to="/plan" className="btn btn-primary">
                      Plan Your First Trip
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              filteredRoutes.map(route => (
                <div
                  key={route.id}
                  className={`card cursor-pointer transition-all ${
                    selectedRoute?.id === route.id
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedRoute(route)}
                >
                  <div className="card-body">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">{getTripTypeIcon(route.tripType)}</span>
                        <h3 className="font-semibold text-gray-900">{route.name}</h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoute(route.id);
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {route.description && (
                      <p className="text-gray-600 text-sm mb-3">{route.description}</p>
                    )}

                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {route.location.city}, {route.location.country}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(route.createdAt)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-blue-600 font-medium">
                          {route.formattedDistance}
                        </span>
                        <span className="text-green-600 font-medium">
                          {route.formattedDuration}
                        </span>
                      </div>
                      <span className={`badge ${getStatusColor(route.status)}`}>
                        {route.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Route Details */}
        <div className="lg:col-span-2">
          {selectedRoute ? (
            <div className="space-y-6">
              {/* Route Header */}
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedRoute.name}</h2>
                      <p className="text-gray-600 mt-1">
                        {selectedRoute.location.city}, {selectedRoute.location.country}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{getTripTypeIcon(selectedRoute.tripType)}</span>
                      <span className={`badge ${getStatusColor(selectedRoute.status)}`}>
                        {selectedRoute.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {selectedRoute.description && (
                    <p className="text-gray-700 mb-4">{selectedRoute.description}</p>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedRoute.totalDistance.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-600">Distance (km)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round(selectedRoute.totalDuration)}
                      </div>
                      <div className="text-sm text-gray-600">Duration (h)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedRoute.routeData?.dailyRoutes?.length || 1}
                      </div>
                      <div className="text-sm text-gray-600">Days</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatDate(selectedRoute.createdAt)}
                      </div>
                      <div className="text-sm text-gray-600">Created</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Route Map */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
                </div>
                <div className="card-body p-0">
                  <RouteMap
                    routeData={selectedRoute.routeData}
                    height="400px"
                    showMarkers={true}
                    showRoute={true}
                  />
                </div>
              </div>

              {/* Weather Forecast */}
              {selectedRoute.weather && (
                <WeatherCard 
                  weather={selectedRoute.weather} 
                  location={selectedRoute.location}
                />
              )}

              {/* Route Image */}
              {selectedRoute.image && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900">Destination Image</h3>
                  </div>
                  <div className="card-body">
                    <img
                      src={selectedRoute.image.url}
                      alt={selectedRoute.image.alt}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center py-16">
                <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Route</h3>
                <p className="text-gray-600">
                  Choose a route from the list to view its details, map, and weather forecast.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedRoutes; 