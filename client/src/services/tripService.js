import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

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
  
    console.log('🟢 planTrip payload before send:', JSON.stringify(payload, null, 2));
  
    const response = await api.post('/trip/plan', payload); // Axios auto JSON
    return response.data.data;
  },
  

  async createRoute(route) {
    const response = await api.post('/routes', route);
    return response.data;
  },
};