import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService } from '../services/tripService';
import { weatherService } from '../services/weatherService';
import RouteMap from '../components/RouteMap';
import WeatherCard from '../components/WeatherCard';
import LoadingSpinner from '../components/LoadingSpinner';
import LocationSearch from '../components/LocationSearch';
import { MapPin, Compass, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const TripPlanner = () => {
  // טופס תכנון: שומרים את כל הערכים במקום אחד כדי לפשט שליחה לשרת
  const [formData, setFormData] = useState({
    location: null,
    tripType: 'hiking',
    imageUrl: '',
    name: '',
    description: ''
  });
  // דגלי טעינה נפרדים: יצירת מסלול / טעינת מזג אוויר
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // תוצרים מהשרת: נתוני מסלול, מזג אוויר, תמונה
  const [routeData, setRouteData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [imageData, setImageData] = useState(null);

  // שליטה על UI לשלב השמירה (כדי לא להעמיס לפני שיש מסלול)
  const [showSaveFields, setShowSaveFields] = useState(false);

  const navigate = useNavigate();

  // שם אוטומטי למסלול לפי מיקום וסוג — החלטת UX: חוסך למשתמש הקלדה
  const getAutoTripName = () => {
    if (!formData.location?.name) return `Unknown ${formData.tripType} trip`;
    const parts = formData.location.name.split(',');
    const city = (parts[0] || '').trim();
    const country = (parts[parts.length - 1] || '').trim();
    return `${city}, ${country} ${formData.tripType} trip`;
  };

  // -------- יצירת מסלול + טעינת מזג אוויר אוטומטית --------
  const generateRoute = async () => {
    // מונעים קריאה לשרת בלי מיקום שנבחר בפועל (מהאוטוקומפליט)
    if (!formData.location) {
      toast.error('Please select a location from the list');
      return;
    }

    // מקבעים lat/lng כמספרים — מונע תקלות מסוג מחרוזת
    const payload = {
      name: formData.location?.name || '',
      lat: Number(formData.location?.lat || 0),
      lng: Number(formData.location?.lng || 0),
    };

    // איפוס תוצרים קודמים לפני יצירה חדשה
    setLoading(true);
    setRouteData(null);
    setWeatherData(null);
    setImageData(null);
    setShowSaveFields(false);

    try {
      // 1) בקשת תכנון מסלול (ה-API מחזיר גם route וגם image)
      const result = await tripService.planTrip(payload, formData.tripType);
      setRouteData(result.route || null);
      setImageData(result.image || null);
      toast.success('Route generated successfully!');

      // 2) מזג אוויר נטען מידית לפי נקודת ההתחלה — החלטת מוצר לנוחות
      setWeatherLoading(true);
      try {
        const data = await weatherService.getForecast(payload.lat, payload.lng);
        setWeatherData(data); // פורמט צפוי: { forecast: [...] }
      } catch (err) {
        toast.error('Failed to load weather.');
      } finally {
        setWeatherLoading(false);
      }
    } catch (error) {
      toast.error('Failed to generate route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // -------- שמירת מסלול (לא שומרים weather בבסיס הנתונים) --------
  const handleSaveClick = () => {
    if (!routeData) {
      toast.error('No route data to save');
      return;
    }
    setShowSaveFields(true); // רק אחרי שיש מסלול מציגים שדות שמירה
  };

  const confirmSave = async () => {
    try {
      // חילוץ עיר/מדינה משם המיקום — פתרון פשוט למבנים שונים של האוטוקומפליט
      const [cityPart, ...restParts] = (formData.location?.name || '').split(',');
      const city = cityPart?.trim() || 'Unknown';
      const country = restParts.pop()?.trim() || 'Unknown';

      // אובייקט שמירה: כולל routeData ותמונה; מזג אוויר לא נשמר כדי לחסוך נפח וקריאות
      const routeToSave = {
        name: getAutoTripName(),
        description: formData.description?.trim() || `Route in ${city}, ${country}`,
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
        image: imageData,
      };

      await tripService.createRoute(routeToSave);
      toast.success('Route saved successfully!');
      navigate('/routes'); // לאחר שמירה — מעבר למסכים שמציגים את הרשימה
    } catch (error) {
      toast.error('Failed to save route. Please try again.');
    }
  };

  // חישובי תקציר להצגה — נשמרים מחוץ ל-JSX לניקיון
  const getRouteStats = () => {
    if (!routeData) return null;
    return {
      totalDistance: routeData.totalDistance,
      totalDuration: routeData.totalDuration,
      dailyRoutes: routeData.dailyRoutes || [],
    };
  };

  const stats = getRouteStats();
  


  return (
    <div className="max-w-7xl mx-auto">
      {/* כותרת ודחיפה חזרה ל-Home */}
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
        {/* טופס התכנון (עמודה שמאלית) */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">Trip Details</h2>
            </div>
            <div className="card-body space-y-6">
              {/* בחירת מיקום דרך קומפוננטת חיפוש — מחזירה אובייקט מאוחד */}
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

              {/* סוג טיול — משפיע על החוקים בצד השרת (הליכה/אופניים) */}
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
                    <span className="text-sm">Cycling (2-day route, max 60 km/day)</span>
                  </label>
                </div>
              </div>

              {/* הפקת מסלול: נועל כפתור בזמן חישוב כדי למנוע לחיצות כפולות */}
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

              {/* תהליך שמירה דו-שלבי: קודם להציג, אחר כך לאשר — מונע טעויות */}
              {!showSaveFields ? (
                <button
                  onClick={handleSaveClick}
                  disabled={!routeData}
                  className="w-full btn btn-secondary mt-4"
                >
                  Save Route
                </button>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Trip Name</div>
                    <div className="font-semibold">{getAutoTripName()}</div>
                  </div>
                  <textarea
                    className="input w-full"
                    rows={3}
                    maxLength={500}
                    placeholder="Description (optional)"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <button
                    onClick={confirmSave}
                    className="w-full btn btn-primary"
                  >
                    Confirm Save
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* תקציר המסלול — מחזק ערך מידי לפני שמירה */}
          {stats && (
            <div className="card mt-6">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Route Summary</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.totalDistance?.toFixed ? stats.totalDistance.toFixed(1) : '-'}
                    </div>
                    <div className="text-sm text-gray-600">Total Distance (km)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Number.isFinite(stats.totalDuration)
                        ? parseFloat(stats.totalDuration.toFixed(1)).toString()
                        : '-'}
                    </div>
                    <div className="text-sm text-gray-600">Duration (hours)</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {(stats.dailyRoutes || []).map((day, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm font-medium">Day {day.day}</span>
                      <span className="text-sm text-gray-600">
                        {day.distance?.toFixed ? day.distance.toFixed(1) : '-'} km
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* מפה ומזג אוויר (עמודה ימנית) */}
        <div className="lg:col-span-2 space-y-6">
          {/* מפה אינטראקטיבית של המסלול */}
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

          {/* מזג אוויר — נטען אוטומטית אחרי יצירת מסלול; מציגים מצב טעינה/חוסר זמינות */}
          {routeData && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Weather Forecast</h3>
              </div>
              <div className="card-body">
                {weatherLoading && <p className="text-sm text-gray-500">Loading weather...</p>}
                {weatherData && (
                  <WeatherCard weather={weatherData} location={{ name: formData.location?.name || '' }} />
                )}
                {!weatherLoading && !weatherData && (
                  <p className="text-sm text-gray-500">Weather is unavailable right now.</p>
                )}
              </div>
            </div>
          )}

          {/* תמונת יעד — מסייעת לקונטקסט ויזואלי, לא קריטי לפונקציונליות */}
          {imageData && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Destination Image</h3>
              </div>
              <div className="card-body">
                <img
                  src={imageData.url}
                  alt={imageData.alt || 'Destination'}
                  className="w-full h-72 object-cover rounded-lg"
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