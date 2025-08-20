import React, { useState } from 'react';
import axios from 'axios';

/**
 * קומפוננטת חיפוש מיקום – שולחת שאילתה ל־Nominatim API ומחזירה תוצאה למרכיב האב.
 * מקבלת prop: onSelect (פונקציה שמטפלת בבחירת מקום)
 */
const LocationSearch = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * מבצעת קריאה ל־API של OpenStreetMap לצורך חיפוש מיקום
   * מוגבלת ל־5 תוצאות, כולל פרטי כתובת
   */
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
    } finally {
      setLoading(false);
    }
  };

  /**
   * בחירת מיקום מהרשימה:
   * מפיק את שם העיר והמדינה מתוך הנתונים המחזרים
   * ומעביר אותם חזרה להורה בצורה אחידה
   */
  const handleSelect = (place) => {
    const { address, lat, lon, display_name } = place;

    // הגדרת שם עיר בצורה בטוחה ממספר שדות
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.state ||
      'Unknown';

    const country = address.country || 'Unknown';

    // שולח את פרטי המקום לקומפוננטת האב
    onSelect({
      name: `${city}, ${country}`,
      lat: parseFloat(lat),
      lng: parseFloat(lon),
    });

    // סוגר את רשימת התוצאות ומעדכן את שורת החיפוש
    setQuery(display_name);
    setResults([]);
  };

  return (
    <div>
      {/* טופס החיפוש */}
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

      {/* תוצאות חיפוש (רשימה נפתחת) */}
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