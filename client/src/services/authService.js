import axios from 'axios';

// הגדרת כתובת בסיס ל־API – או מהסביבה, או ברירת מחדל מקומית
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// יצירת מופע axios עם הגדרות בסיסיות (Base URL + סוג תוכן JSON)
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interceptor לבקשות – מוסיף Token אם קיים ב־localStorage
 * זה מאפשר לשלוח את ה־JWT בכל בקשה מאובטחת בלי להוסיף ידנית בכל קריאה
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
 * Interceptor לתגובות – בודק אם השרת החזיר 401 (Unauthorized)
 * במקרה כזה מוחקים את ה־Token ומבצעים הפניה למסך התחברות
 * מונע מצב של עבודה עם Token שפג תוקף
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
  /**
   * רישום משתמש חדש
   * שולח שם, אימייל וסיסמה ל־API
   */
  async register(name, email, password) {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
    });
    return response.data.data;
  },

  /**
   * התחברות משתמש
   * שולח אימייל וסיסמה ל־API ומקבל חזרה Token + פרטי משתמש
   */
  async login(email, password) {
    const response = await api.post('/auth/login', {
      email,
      password,
    });
    return response.data.data;
  },

  /**
   * קבלת פרטי המשתמש הנוכחי לפי ה־Token
   */
  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data.data.user;
  },

  /**
   * עדכון פרטי פרופיל משתמש
   */
  async updateProfile(profileData) {
    const response = await api.put('/auth/profile', profileData);
    return response.data.data.user;
  },

  /**
   * שינוי סיסמה – דורש סיסמה נוכחית וסיסמה חדשה
   */
  async changePassword(currentPassword, newPassword) {
    const response = await api.put('/auth/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};