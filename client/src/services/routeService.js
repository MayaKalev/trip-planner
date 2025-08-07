import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const routeService = {
  // Get all routes for current user
  async getRoutes(params = {}) {
    const response = await api.get('/routes', { params });
    return response.data.data;
  },

  // Get single route by ID
  async getRoute(id) {
    const response = await api.get(`/routes/${id}`);
    return response.data.data.route;
  },

  // Create new route
  async createRoute(routeData) {
    const response = await api.post('/routes', routeData);
    return response.data.data.route;
  },

  // Update route
  async updateRoute(id, routeData) {
    const response = await api.put(`/routes/${id}`, routeData);
    return response.data.data.route;
  },

  // Delete route
  async deleteRoute(id) {
    const response = await api.delete(`/routes/${id}`);
    return response.data;
  },

  // Get route statistics
  async getRouteStats() {
    const response = await api.get('/routes/stats');
    return response.data.data.stats;
  },
}; 