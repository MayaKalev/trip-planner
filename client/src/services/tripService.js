import axios from 'axios';

// Base API URL — from environment or default to local
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create an axios instance with fixed defaults
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Request interceptor — adds an Authorization header with the JWT
 * if a token exists in localStorage, so all requests are automatically authenticated.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const tripService = {
  async planTrip(location, tripType) {
    const payload = {
      location: {
        name: location.name,
        lat: location.lat,
        lng: location.lng,
      },
      tripType,
    };

    const response = await api.post('/trip/plan', payload);
    return response.data.data;
  },

  async createRoute(route) {
    const response = await api.post('/routes', route);
    return response.data;
  },
};