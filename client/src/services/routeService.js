import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Token interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Prevent browser/proxy caching on GETs (avoids 304 without body)
function withNoCache(config = {}) {
  const ts = Date.now().toString();
  return {
    ...config,
    params: { ...(config.params || {}), ts }, // cache-busting query param
  };
}

export const routeService = {
  /**
   * Get all routes (summaries) for current user
   * Returns: { routes, pagination }
   */
  async getRoutes(params = {}, { noCache = true } = {}) {
    const cfg = noCache ? withNoCache({ params }) : { params };
    const res = await api.get('/routes', cfg);
    return res.data.data; // { routes, pagination }
  },

  /**
   * Get single route details
   * Returns: { route }
   */
  async getRoute(id, { noCache = true } = {}) {
    const cfg = noCache ? withNoCache() : undefined;
    const res = await api.get(`/routes/${id}`, cfg);
    return res.data.data; // { route }
  },

  /**
   * Create a new route
   * Returns: route
   */
  async createRoute(routeData) {
    const res = await api.post('/routes', routeData);
    return res.data.data.route;
  },

  /**
   * Update a route
   * Returns: route
   */
  async updateRoute(id, routeData) {
    const res = await api.put(`/routes/${id}`, routeData);
    return res.data.data.route;
  },

  /**
   * Delete a route
   */
  async deleteRoute(id) {
    const res = await api.delete(`/routes/${id}`);
    return res.data; // { success, message }
  },

  /**
   * Get aggregated stats
   * Returns: stats object
   */
  async getRouteStats({ noCache = true } = {}) {
    const cfg = noCache ? withNoCache() : undefined;
    const res = await api.get('/routes/stats', cfg);
    return res.data.data.stats;
  },
};