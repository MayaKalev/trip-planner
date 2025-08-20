import axios from 'axios';

// כתובת בסיס ל־API – מהסביבה או ברירת מחדל מקומית
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// יצירת מופע axios עם הגדרות קבועות
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Interceptor לבקשות – מוסיף Authorization header עם ה־JWT
 * אם קיים Token ב־localStorage, כך שכל הבקשות יהיו מאובטחות אוטומטית
 */
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
  /**
   * יצירת תכנית טיול חדשה לפי מיקום וסוג טיול
   * - location: אובייקט עם name, lat, lng
   * - tripType: סוג הטיול (למשל Hiking / Cycling)
   * 
   * הלוגיקה יוצרת payload אחיד לשרת, מדפיסה אותו ללוג לצורך דיבאג,
   * ושולחת POST ל־/trip/plan
   */
  async planTrip(location, tripType) {
    const payload = {
      location: {
        name: location.name,
        lat: location.lat,
        lng: location.lng,
      },
      tripType,
    };
  
  
    // axios ממיר אוטומטית ל־JSON
    const response = await api.post('/trip/plan', payload);
    return response.data.data;
  },
  
  /**
   * שמירת מסלול חדש בשרת
   * מקבל אובייקט מסלול מלא ושולח אותו ל־/routes
   */
  async createRoute(route) {
    const response = await api.post('/routes', route);
    return response.data;
  },
};