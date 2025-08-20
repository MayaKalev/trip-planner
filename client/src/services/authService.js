
import axios from 'axios';

// Set base API URL — from environment or default to local
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create an axios instance with basic settings (Base URL + JSON content type)
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor — adds a token if it exists in localStorage.
 * This allows sending the JWT with every secured request without adding it manually each time.
 */
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

/**
 * Response interceptor — checks if the server returned 401 (Unauthorized).
 * In that case, remove the token and redirect to the login page.
 * Prevents working with an expired token.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async register(name, email, password) {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
    });
    return response.data.data;
  },

  async login(email, password) {
    const response = await api.post('/auth/login', {
      email,
      password,
    });
    return response.data.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data.data.user;
  },

  async updateProfile(profileData) {
    const response = await api.put('/auth/profile', profileData);
    return response.data.data.user;
  },

  async changePassword(currentPassword, newPassword) {
    const response = await api.put('/auth/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};
