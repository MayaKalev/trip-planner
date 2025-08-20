import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import TripPlanner from './pages/TripPlanner';
import SavedRoutes from './pages/SavedRoutes';
import Profile from './pages/Profile';
import LoadingSpinner from './components/LoadingSpinner';

/**
 * ProtectedRoute component — protects routes that require authentication.
 * If the user is not logged in, it automatically redirects to the login page.
 * If the auth state is still loading, it shows a loading animation.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />; 
  }
  
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation bar — always shown */}
      <Navbar />

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected pages — wrapped in <ProtectedRoute> */}
          <Route 
            path="/plan" 
            element={
              <ProtectedRoute>
                <TripPlanner />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/routes" 
            element={
              <ProtectedRoute>
                <SavedRoutes />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />

          {/* Automatic redirect for any unknown route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;