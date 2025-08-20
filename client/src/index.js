import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

// יצירת root עבור האפליקציה בתוך האלמנט עם id="root"
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  // StrictMode משמש לבדיקה והרצת אזהרות בזמן פיתוח
  <React.StrictMode>
    {/* BrowserRouter מספק ניהול ראוטים בצד הלקוח */}
    <BrowserRouter>
      {/* AuthProvider מספק הקשר (context) של משתמש מחובר לכל האפליקציה */}
      <AuthProvider>
        {/* קומפוננטת ה־App הראשית */}
        <App />
        {/* Toaster – תצוגת התראות (toast) גלובלית */}
        <Toaster
          position="top-right" // מיקום ההודעות
          toastOptions={{
            duration: 4000, // זמן ברירת מחדל להצגת הודעה
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);