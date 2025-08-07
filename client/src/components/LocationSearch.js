import React, { useState } from 'react';
import axios from 'axios';

const LocationSearch = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // חיפוש מיקום לפי שאילתת המשתמש
  const searchLocation = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResults([]);

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          format: 'json',
          addressdetails: 1,
          limit: 5
        }
      });
      setResults(response.data);
    } catch (error) {
      console.error('Location search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // הפונקציה שמכינה את האובייקט לבחירה
  const handleSelect = (place) => {
    // הפקת city ו-country בצורה בטוחה
    const { address, lat, lon, display_name } = place;

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.state ||
      'Unknown';

    const country = address.country || 'Unknown';

    // החזרת אובייקט מלא ל־TripPlanner
    onSelect({
      name: `${city}, ${country}`,
      lat: parseFloat(lat),
      lng: parseFloat(lon),
    });

    // עדכון התיבה וסגירת התוצאות
    setQuery(display_name);
    setResults([]);
  };

  return (
    <div>
      <form onSubmit={searchLocation} className="flex space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a city or place"
          className="input flex-1"
        />
        <button type="submit" className="btn btn-secondary" disabled={loading}>
          {loading ? '...' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="border rounded mt-2 max-h-48 overflow-y-auto bg-white shadow-md z-10 relative">
          {results.map((place, index) => (
            <li
              key={index}
              onClick={() => handleSelect(place)}
              className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
            >
              {place.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch;
