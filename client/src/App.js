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
 * רכיב ProtectedRoute – מגן על מסלולים (Routes) שדורשים התחברות.
 * אם המשתמש לא מחובר – מפנה אוטומטית לעמוד ההתחברות.
 * אם עדיין טוענים את מצב ההתחברות – מציג אנימציית טעינה.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />; // מצב ביניים בזמן בדיקת ההתחברות
  }
  
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  const { loading } = useAuth();

  // טעינת אפליקציה – הצגת ספינר בזמן בדיקת מצב התחברות ראשוני
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* תפריט ניווט עליון – מוצג תמיד */}
      <Navbar />

      {/* התוכן הראשי */}
      <main className="container mx-auto px-4 py-8">
        <Routes>
          {/* דפי גישה חופשית */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* דפים מוגנים – עטופים ב-<ProtectedRoute> */}
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

          {/* הפניה אוטומטית לכל נתיב לא קיים */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;