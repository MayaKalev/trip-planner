// client/src/services/weatherService.js
import axios from 'axios';

// כתובת בסיס ל־API – נלקחת מהסביבה או ברירת מחדל לשרת מקומי
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// יצירת מופע axios עם timeout מובנה
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// Interceptor לבקשות – מוסיף Authorization Header עם ה־JWT אם קיים ב־localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const weatherService = {
  // מחזיר תחזית 3 ימים קדימה לפי קואורדינטות
  // מקבל lat ו־lng, מוודא שהם מספרים תקינים, ושולח GET לנתיב /weather/:lat/:lng
  async getForecast(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);

    // בדיקת תקינות קואורדינטות לפני שליחת הבקשה
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      throw new Error('Invalid coordinates for weather lookup');
    }

    const res = await api.get(`/weather/${latNum}/${lngNum}`);

    // במידה והבקשה הצליחה, מחזירים את ה־data מהשרת
    if (res?.data?.success) {
      return res.data.data; // למשל { forecast: [...] }
    }

    // במידה והבקשה נכשלה, נזרקת שגיאה עם הודעה מתאימה
    throw new Error(res?.data?.message || 'Failed to load weather');
  },
};