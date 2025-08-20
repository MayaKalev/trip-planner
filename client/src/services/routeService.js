import axios from 'axios';

// Set base API URL — from environment or default to local
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create an axios instance with default settings
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Request interceptor — adds a token if it exists in localStorage.
 * Allows every API call to be authenticated without manually adding Authorization.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Helper to prevent browser/proxy caching when fetching data (GET).
 * Adds a unique timestamp query param — avoids 304 responses with empty bodies.
 */
function withNoCache(config = {}) {
  const ts = Date.now().toString();
  return {
    ...config,
    params: { ...(config.params || {}), ts },
  };
}

export const routeService = {
  /**
   * Fetch all routes for the current user
   */
  async getRoutes(params = {}, { noCache = true } = {}) {
    const cfg = noCache ? withNoCache({ params }) : { params };
    const res = await api.get('/routes', cfg);
    return res.data.data;
  },

  async getRoute(id, { noCache = true } = {}) {
    const cfg = noCache ? withNoCache() : undefined;
    const res = await api.get(`/routes/${id}`, cfg);
    return res.data.data;
  },

  async createRoute(routeData) {
    const res = await api.post('/routes', routeData);
    return res.data.data.route;
  },

  async deleteRoute(id) {
    const res = await api.delete(`/routes/${id}`);
    return res.data;
  },

  async getRouteStats({ noCache = true } = {}) {
    const cfg = noCache ? withNoCache() : undefined;
    const res = await api.get('/routes/stats', cfg);
    return res.data.data.stats;
  },
};