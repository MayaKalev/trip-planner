// server/routes/weather.js
const express = require('express');
const { getWeatherData } = require('../controllers/weatherController');
const { protect } = require('../middleware/auth'); // Middleware שמוודא שהמשתמש מחובר (JWT)
const router = express.Router();

/**
 * מסלול API – קבלת תחזית מזג אוויר ל־3 ימים הבאים לפי קואורדינטות
 * הנתיב כולל שני פרמטרים דינמיים: lat ו־lng
 * דוגמה לשימוש: GET /api/weather/32.0853/34.7818
 */
router.get('/:lat/:lng', async (req, res, next) => {
  try {
    // המרת הפרמטרים למספרים על מנת לוודא שניתן לעבוד איתם
    const lat = Number(req.params.lat);
    const lng = Number(req.params.lng);

    // ולידציה – במקרה שהקואורדינטות לא חוקיות מחזירים שגיאה 400
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. lat and lng must be numbers',
      });
    }

    // קריאה לפונקציית הלוגיקה שמביאה תחזית עדכנית מה־API של OpenWeatherMap
    const data = await getWeatherData(lat, lng);

    // החזרת הנתונים בפורמט אחיד ללקוח
    return res.json({ success: true, data });
  } catch (err) {
    // העברת השגיאה למנגנון הטיפול המרכזי ב־Express
    return next(err);
  }
});

module.exports = router;