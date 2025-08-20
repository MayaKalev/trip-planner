import axios from 'axios';

// הגדרת כתובת בסיס ל־API – או מהסביבה, או ברירת מחדל מקומית
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// יצירת מופע axios עם הגדרות ברירת מחדל
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Interceptor לבקשות – מוסיף Token אם קיים ב־localStorage
 * מאפשר לכל קריאה ל־API להיות מאובטחת בלי הצורך להוסיף Authorization ידנית
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
 * פונקציה למניעת קאש בדפדפן/פרוקסי בעת שליפת נתונים (GET)
 * מוסיפה פרמטר ייחודי לפי חותמת זמן – מונע קבלת 304 ללא גוף תגובה
 */
function withNoCache(config = {}) {
  const ts = Date.now().toString();
  return {
    ...config,
    params: { ...(config.params || {}), ts }, // מוסיפים את פרמטר ה־ts לשורת השאילתה
  };
}

export const routeService = {
  /**
   * שליפת כל המסלולים של המשתמש הנוכחי
   * כולל פרמטרים לסינון
   */
  async getRoutes(params = {}, { noCache = true } = {}) {
    const cfg = noCache ? withNoCache({ params }) : { params };
    const res = await api.get('/routes', cfg);
    return res.data.data;
  },

  /**
   * שליפת פרטי מסלול בודד לפי מזהה
   * מחזיר: { route }
   */
  async getRoute(id, { noCache = true } = {}) {
    const cfg = noCache ? withNoCache() : undefined;
    const res = await api.get(`/routes/${id}`, cfg);
    return res.data.data;
  },

  /**
   * יצירת מסלול חדש
   * מחזיר: route
   */
  async createRoute(routeData) {
    const res = await api.post('/routes', routeData);
    return res.data.data.route;
  },

  /**
   * עדכון מסלול קיים
   * מחזיר: route
   */
  async updateRoute(id, routeData) {
    const res = await api.put(`/routes/${id}`, routeData);
    return res.data.data.route;
  },

  /**
   * מחיקת מסלול לפי מזהה
   * מחזיר: { success, message }
   */
  async deleteRoute(id) {
    const res = await api.delete(`/routes/${id}`);
    return res.data;
  },

  /**
   * שליפת נתוני סטטיסטיקות מצטברות על המסלולים
   * מחזיר: stats object
   */
  async getRouteStats({ noCache = true } = {}) {
    const cfg = noCache ? withNoCache() : undefined;
    const res = await api.get('/routes/stats', cfg);
    return res.data.data.stats;
  },
};