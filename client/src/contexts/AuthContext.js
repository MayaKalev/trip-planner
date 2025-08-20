// File: client/src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

// Create a global context object to hold auth state and actions
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  // Guard against usage outside the Provider (to avoid silent bugs)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Provider that wraps the entire app and supplies values/actions to children
export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // On app load (or when the token changes) check if the user is authenticated (GET /auth/me)
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          // Requires an axios interceptor that adds the Authorization header
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  // Login: send email + password to the server (POST /auth/login)
  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      const { user: userData, token: authToken } = response;

      setUser(userData);
      setToken(authToken);
      localStorage.setItem('token', authToken);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed'
      };
    }
  };

  // Registration: send name + email + password to the server (POST /auth/register)
  const register = async (name, email, password) => {
    try {
      const response = await authService.register(name, email, password);
      const { user: userData, token: authToken } = response;

      setUser(userData);
      setToken(authToken);
      localStorage.setItem('token', authToken);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed'
      };
    }
  };

  // Logout: reset client state and remove the token (no API call needed)
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  // Update profile: secured call to the server (e.g., PUT /auth/profile)
  const updateProfile = async (profileData) => {
    try {
      const updatedUser = await authService.updateProfile(profileData);
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Profile update failed'
      };
    }
  };

  // Change password: secured call (e.g., PUT /auth/password)
  const changePassword = async (currentPassword, newPassword) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Password change failed'
      };
    }
  };

  // Value provided to all components in the app via context
  const value = {
    user,
    loading,
    token,
    login,
    register,
    logout,
    updateProfile,
    changePassword
  };

  // Wrap children with the Provider so the whole app can access values/functions
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};