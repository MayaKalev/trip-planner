// controllers/imageController.js
const axios = require('axios');

// פונקציה טהורה לשימוש פנימי (service-like)
async function fetchImageByLocation(location) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    console.warn('UNSPLASH_ACCESS_KEY not set – using fallback image');
    return {
      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      alt: `${location} landscape (fallback)`
    };
  }

  try {
    const { data } = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query: location, orientation: 'landscape', per_page: 1 },
      headers: { Authorization: `Client-ID ${accessKey}` },
      timeout: 15000
    });

    const img = data?.results?.[0];
    if (img) {
      return {
        url: img.urls?.regular || img.urls?.small,
        alt: img.alt_description || `${location} view`,
        credit: img.user?.name,
        source: img.links?.html
      };
    }
  } catch (err) {
    console.error('Unsplash fetch error:', err.message);
  }

  // fallback
  return {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    alt: `${location} landscape (fallback)`
  };
}

// קונטרולר לראוט GET /api/image?location=...
async function getImageByLocation(req, res) {
  try {
    const { location } = req.query;
    if (!location) {
      return res.status(400).json({ success: false, message: 'Location is required' });
    }
    const image = await fetchImageByLocation(location);
    return res.json({ success: true, image });
  } catch (err) {
    console.error('getImageByLocation error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch image' });
  }
}

module.exports = { getImageByLocation, fetchImageByLocation };
