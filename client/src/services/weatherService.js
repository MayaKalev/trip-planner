// client/src/services/weatherService.js
import axios from 'axios';

// Base API URL — taken from the environment or defaulting to a local server
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create an axios instance with a built-in timeout
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// Request interceptor — adds an Authorization header with the JWT if it exists in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const weatherService = {
  // Returns a 3-day forecast by coordinates
  // Accepts lat and lng, validates they are valid numbers, and sends GET to /weather/:lat/:lng
  async getForecast(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      throw new Error('Invalid coordinates for weather lookup');
    }

    const res = await api.get(`/weather/${latNum}/${lngNum}`);

    if (res?.data?.success) {
      return res.data.data;
    }

    throw new Error(res?.data?.message || 'Failed to load weather');
  },
};