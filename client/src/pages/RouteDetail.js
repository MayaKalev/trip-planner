import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { routeService } from '../services/routeService';
import RouteMap from '../components/RouteMap';
import WeatherCard from '../components/WeatherCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { ArrowLeft, MapPin, Calendar, Clock, Edit, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

const RouteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  // טעינת פרטי המסלול (קריאה אחת בלבד)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const payload = await routeService.getRoute(id, { noCache: true });
        const r = payload?.route ?? payload; // תומך בשתי הצורות
        if (!mounted) return;
        setRoute(r);
        setEditForm({
          name: r?.name ?? '',
          description: r?.description ?? '',
          notes: r?.notes ?? ''
        });
      } catch (e) {
        console.error('getRoute error:', e);
        toast.error('Failed to load route');
        navigate('/routes');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, navigate]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await routeService.updateRoute(id, editForm);
      const r = updated?.route ?? updated;
      setRoute(r);
      setEditing(false);
      toast.success('Route updated successfully');
    } catch (error) {
      console.error('Error updating route:', error);
      toast.error('Failed to update route');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this route? This action cannot be undone.')) return;
    try {
      await routeService.deleteRoute(id);
      toast.success('Route deleted successfully');
      navigate('/routes');
    } catch (error) {
      console.error('Error deleting route:', error);
      toast.error('Failed to delete route');
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const getTripTypeIcon = (tripType) => (tripType === 'hiking' ? '🥾' : '🚴');


  if (loading) return <LoadingSpinner text="Loading route..." />;

  if (!route) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Route Not Found</h2>
        <p className="text-gray-600 mb-6">The route you're looking for doesn't exist or has been deleted.</p>
        <button onClick={() => navigate('/routes')} className="btn btn-primary">
          Back to Routes
        </button>
      </div>
    );
  }

  const centerFallback =
    isFiniteNumber(route?.location?.coordinates?.lat) &&
    isFiniteNumber(route?.location?.coordinates?.lng)
      ? [route.location.coordinates.lat, route.location.coordinates.lng]
      : undefined;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/routes')}
          className="flex items-center text-gray-600 hover:text-blue-600 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Routes
        </button>

        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-3xl">{getTripTypeIcon(route.tripType)}</span>
              <h1 className="text-3xl font-bold text-gray-900">
                {editing ? (
                  <input
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    className="input text-3xl font-bold p-0 border-0 bg-transparent"
                  />
                ) : (
                  route.name
                )}
              </h1>
            </div>
            <p className="text-gray-600 text-lg">
              {route.location?.city}, {route.location?.country}
            </p>
          </div>

          <div className="flex space-x-2">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? (
                    <div className="flex items-center">
                      <div className="spinner w-4 h-4 mr-2"></div>
                      Saving...
                    </div>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </button>
                <button onClick={() => setEditing(false)} className="btn btn-secondary">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="btn btn-secondary">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
                <button onClick={handleDelete} className="btn btn-danger">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Route Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Basic Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Route Information</h3>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {route.formattedDistance ?? '—'}
                </div>
                <div className="text-sm text-gray-600">Total Distance</div>

                <div className="text-2xl font-bold text-green-600">
                  {route.formattedDuration ?? '—'}
                </div>
                <div className="text-sm text-gray-600">Duration</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {route.routeData?.dailyRoutes?.length || 1}
                  </div>
                  <div className="text-sm text-gray-600">Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{route.tripType}</div>
                  <div className="text-sm text-gray-600">Type</div>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Description</h3>
            </div>
            <div className="card-body">
              {editing ? (
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  className="input w-full"
                  rows="4"
                  placeholder="Add a description for this route"
                />
              ) : (
                <p className="text-gray-700">{route.description || 'No description provided.'}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
            </div>
            <div className="card-body">
              {editing ? (
                <textarea
                  name="notes"
                  value={editForm.notes}
                  onChange={handleEditChange}
                  className="input w-full"
                  rows="4"
                  placeholder="Add personal notes about this route"
                />
              ) : (
                <p className="text-gray-700">{route.notes || 'No notes added yet.'}</p>
              )}
            </div>
          </div>

          {/* Route Details */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Route Details</h3>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Created: {formatDate(route.createdAt)}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>Location: {route.location?.city}, {route.location?.country}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Last updated: {formatDate(route.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Map and Weather */}
        <div className="lg:col-span-2 space-y-6">
          {/* Route Map */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
            </div>
            <div className="card-body p-0">
              <RouteMap
                routeData={route?.routeData}
                center={route?.center ?? centerFallback}
                showMarkers
                showRoute
                height="500px"
              />
            </div>
          </div>

          {/* Weather Forecast */}
          {route.weather && <WeatherCard weather={route.weather} location={route.location} />}

          {/* Route Image */}
          {route.image && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Destination Image</h3>
              </div>
              <div className="card-body">
                <img
                  src={route.image.url}
                  alt={route.image.alt}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteDetail;