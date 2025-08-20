const axios = require('axios');


async function fetchImageByLocation(location) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return {
      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      alt: `${location} landscape (fallback)`
    };
  }

  try {
    // Focused search: one horizontal image relevant to the location
    const { data } = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query: location, orientation: 'landscape', per_page: 1 },
      headers: { Authorization: `Client-ID ${accessKey}` },
      timeout: 15000 // Prevents hanging in case of slow network
    });

    // Safely select the first result, with alternative fields for description/link
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
    // Error is silently ignored here, fallback will be used
  }

  // Fallback in case of no results/error – ensures consistent UX
  return {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    alt: `${location} landscape (fallback)`
  };
}

// Controller for GET /api/image?location=... – basic validation + service usage
async function getImageByLocation(req, res) {
  try {
    const { location } = req.query;
    if (!location) {
      return res.status(400).json({ success: false, message: 'Location is required' });
    }
    const image = await fetchImageByLocation(location);
    return res.json({ success: true, image });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch image' });
  }
}

module.exports = { getImageByLocation, fetchImageByLocation };
