import React, { useState } from 'react';
import axios from 'axios';

/**
 * Location search component — sends a query to the Nominatim API
 * and returns the selected result to the parent component.
 * Props: onSelect (function that handles place selection)
 */
const LocationSearch = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * Calls the OpenStreetMap (Nominatim) API to search for a place.
   * Limited to 5 results and includes address details.
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
      // Optional: handle or log the error
    } finally {
      setLoading(false);
    }
  };

  /**
   * Selecting a place from the list:
   * Extracts city and country from the returned data
   * and passes them back to the parent in a normalized shape.
   */
  const handleSelect = (place) => {
    const { address, lat, lon, display_name } = place;

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.state ||
      'Unknown';

    const country = address.country || 'Unknown';

    // Send the selected place details to the parent component
    onSelect({
      name: `${city}, ${country}`,
      lat: parseFloat(lat),
      lng: parseFloat(lon),
    });

    
    setQuery(display_name);
    setResults([]);
  };

  return (
    <div>
      {/* Search form */}
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

      {/* Search results (dropdown list) */}
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