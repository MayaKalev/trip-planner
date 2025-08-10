const { getWeatherData } = require('./weatherController');
const { asyncHandler } = require('../middleware/errorHandler');
const { fetchImageByLocation } = require('../controllers/imageController');
const Groq = require('groq-sdk');
const axios = require('axios');

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @desc    Generate trip route with AI
// @route   POST /api/trip/plan
// @access  Private
const planTrip = asyncHandler(async (req, res) => {
  let { location, tripType } = req.body;

  // אם location הגיע כמחרוזת JSON - ננסה לפרסר
  if (typeof location === 'string') {
    try {
      location = JSON.parse(location);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid location format' });
    }
  }
  
  if (!location || !Number(location.lat) || !Number(location.lng)) {
    return res.status(400).json({
      success: false,
      message: 'Location with lat/lng is required',
    });
  }

  try {
    const routeData = await generateRoute(location.name, tripType);
    const weatherData = await getWeatherData(Number(location.lat), Number(location.lng));
    const imageData = await fetchImageByLocation(location.name);

    res.json({
      success: true,
      data: { route: routeData,
         weather: weatherData,
         image: imageData  },
    });
  } catch (error) {
    console.error('Trip planning error:', error);
    res.status(500).json({ success: false, message: 'Failed to plan trip' });
  }
});





module.exports = { planTrip };


// Haversine (מרחק במטרים) עבור [lon,lat]
const toRad = d => (d * Math.PI) / 180;
function haversineMetersLonLat(a, b) {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const la1 = toRad(lat1), la2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const generateRoute = async (location, tripType) => {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`AI waypoint generation attempt ${attempt}/${maxRetries} for ${location} ${tripType}`);

    const isRetry = attempt > 1;
    const waypointsResponse = await generateRouteWithAI(location, tripType, isRetry);

    if (waypointsResponse && waypointsResponse.waypoints && isWaypointsValid(waypointsResponse.waypoints)) {
      console.log(`AI waypoint generation successful - ${waypointsResponse.waypoints.length} waypoints`);

      // Use OpenRouteService to generate the actual route from waypoints
      try {
        const apiKey = process.env.OPENROUTESERVICE_API_KEY;
        console.log('🔑 ORS Key loaded?', apiKey ? 'YES' : 'NO');
        if (apiKey) {
          console.log('🔑 ORS Key preview:', apiKey.slice(0, 5) + '...' + apiKey.slice(-3));
        }
        const route = await generateRouteWithOpenRouteService(waypointsResponse.waypoints, tripType);
        console.log(`OpenRouteService route generation successful - ${route.points.length} points`);
        return route;
      } catch (orsError) {
        console.log(`OpenRouteService failed: ${orsError.message}, retrying AI waypoints...`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } else {
          throw new Error(`Failed to generate route: ${orsError.message}`);
        }
      }
    }

    // Debug logging to see what the AI is actually returning
    console.log(`AI waypoint generation attempt ${attempt} failed or invalid, retrying...`);
    console.log('AI Response:', JSON.stringify(waypointsResponse, null, 2));
    if (waypointsResponse && waypointsResponse.waypoints) {
      console.log(`Waypoints found: ${waypointsResponse.waypoints.length}`);
      console.log('First waypoint:', waypointsResponse.waypoints[0]);
    }
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // If all attempts fail, throw an error
  throw new Error("AI failed to generate realistic waypoints after multiple attempts.");
};

// Snap waypoint to nearest road/trail for better ORS routing
// Batch snap all waypoints using ORS Snap API
// Batch snap all waypoints using ORS Snap API
const snapWaypoints = async (waypoints, tripType) => {
  const profile = tripType === 'cycling' ? 'cycling-regular' : 'foot-hiking';
  const locations = waypoints.map(wp => [wp.lng, wp.lat]); // [lon, lat]
  const radius = tripType === 'cycling' ? 120 : 200;       // meters (קטן כדי לא "לזלוג" למים)

  try {
    const { data } = await axios.post(
      `https://api.openrouteservice.org/v2/snap/${profile}/json`,
      { locations, radius },
      {
        headers: {
          Authorization: process.env.OPENROUTESERVICE_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        timeout: 20000
      }
    );

    const snapped = (data?.locations || []).map(item => item?.location || null);

    // אם יש נקודות שלא נצמדו – נכשיל את הניסיון (כדי לייצר waypoints חדשים)
    if (snapped.length !== locations.length || snapped.some(p => !p)) {
      throw new Error('Some waypoints failed to snap (off network / over water).');
    }
    return snapped; // [[lon,lat], ...]
  } catch (error) {
    console.error(
      'Snap API error:',
      error.response?.status,
      JSON.stringify(error.response?.data || { message: error.message }, null, 2)
    );
    throw new Error('Snap failed'); // לא משתמשים בנקודות המקוריות
  }
};





// Generate route using OpenRouteService with waypoints
const generateRouteWithOpenRouteService = async (waypoints, tripType) => {
  try {
    console.log(`Generating route with OpenRouteService for ${tripType} with ${waypoints.length} waypoints`);

    // Snap all waypoints in one request
    const coordinates = await snapWaypoints(waypoints, tripType);

    // באופניים – לוודא שמסיימים חזרה בתחנה הראשונה (לולאה)
    if (tripType === 'hiking' && coordinates.length > 1) {
      const start = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      const d = haversineMetersLonLat(start, last);
      if (d > 100) coordinates.push(start);
    }

    console.log(' First snapped coordinate:', coordinates[0]);

    // Determine profile based on trip type
    const profile = tripType === 'cycling' ? 'cycling-regular' : 'foot-hiking';
    const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

    // Request body
    const baseBody = {
      coordinates,                           // [[lon,lat], ...]
      instructions: true,
      extra_info: ['waytype', 'steepness', 'surface'],
      geometry_simplify: false
    };

    // ננסה לחסום מעבורות; אם ה-API לא תומך ניפול ל-baseBody
    const bodyWithAvoid = { ...baseBody, options: { avoid_features: ['ferries'] } };

    let response;
    try {
      response = await axios.post(url, bodyWithAvoid, {
        headers: {
          Authorization: process.env.OPENROUTESERVICE_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    } catch (err) {
      const msg = err.response?.data?.error?.message || '';
      const isUnknownParam =
        err.response?.status === 400 &&
        /Unknown parameter.*(options|avoid_features)/i.test(msg);

      if (isUnknownParam) {
        // ניסיון חוזר ללא options
        response = await axios.post(url, baseBody, {
          headers: {
            Authorization: process.env.OPENROUTESERVICE_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
      } else {
        throw err;
      }
    }

    // Validate response
    if (!response.data?.features?.length) {
      throw new Error('No route found');
    }

    const feature = response.data.features[0];
    const geometry = feature.geometry;
    const properties = feature.properties || {};

    // --- פיצול ליומיים באופניים, יום אחד בהליכה ---
    const coords = geometry.coordinates; // [ [lon,lat], ... ]

    // אורך מצטבר לאורך ה-geometry (במטרים)
    const cum = [0];
    for (let i = 1; i < coords.length; i++) {
      cum[i] = cum[i - 1] + haversineMetersLonLat(coords[i - 1], coords[i]);
    }
    const totalGeomMeters = cum[cum.length - 1] || (properties.summary?.distance || 0);

    // נקודת חיתוך באמצע (לפי מרחק מצטבר)
    let splitIdx = Math.max(1, cum.findIndex(v => v >= totalGeomMeters / 2));
    if (splitIdx === -1) splitIdx = Math.floor(coords.length / 2);

    // בניית נקודות עם day 1/2 לאופניים (להליכה תמיד 1)
    const points = [];
    let order = 0;
    for (let i = 0; i < coords.length; i++) {
      const [lon, lat] = coords[i];
      const day = (tripType === 'cycling') ? (i <= splitIdx ? 1 : 2) : 1;
      points.push({ lat, lng: lon, day, order: order++ });
    }

    // מרחק/זמן לכל יום
    const totalMeters = properties.summary?.distance || totalGeomMeters;
    const totalSec = properties.summary?.duration || 0;

     // דרישות מרחק לפי סוג טיול
    if (tripType === 'cycling') {
      // מסלול יומיים, עד 60 ק"מ ליום -> עד 120 ק"מ סה"כ
      const totalKm = totalMeters / 1000;
      if (totalKm > 120) {
        throw new Error(`Cycling route too long: ${totalKm.toFixed(1)} km (max 120 km total).`);
      }
    } else {
      // הליכה: יום אחד, 5–15 ק"מ
      const totalKm = totalMeters / 1000;
      if (totalKm < 5 || totalKm > 15) {
        throw new Error(`Hiking route distance ${totalKm.toFixed(1)} km out of range (5–15 km).`);
      }
    }

    const day1Meters = (tripType === 'cycling') ? cum[splitIdx] : totalMeters;
    const day2Meters = (tripType === 'cycling') ? (totalMeters - day1Meters) : 0;

    const day1Frac = Math.max(0, Math.min(1, day1Meters / Math.max(totalMeters, 1)));
    const day2Frac = 1 - day1Frac;

    const dailyRoutes = (tripType === 'cycling')
      ? [
        {
          day: 1,
          distance: day1Meters / 1000,
          duration: (totalSec * day1Frac) / 3600,
          points: points.filter(p => p.day === 1)
        },
        {
          day: 2,
          distance: day2Meters / 1000,
          duration: (totalSec * day2Frac) / 3600,
          points: points.filter(p => p.day === 2)
        }
      ]
      : [
        {
          day: 1,
          distance: totalMeters / 1000,
          duration: totalSec / 3600,
          points
        }
      ];

    // --- ההחזרה ---
    return {
      geometry,
      points,
      dailyRoutes,
      totalDistance: totalMeters / 1000,
      totalDuration: totalSec / 3600
    };

  } catch (error) {
    console.error(
      'OpenRouteService error:',
      error.response?.status,
      JSON.stringify(error.response?.data || { message: error.message }, null, 2)
    );
    throw new Error(`Failed to generate route with OpenRouteService: ${error.message}`);
  }
};


// Generate route via Groq LLM with retry mechanism
const generateRouteWithAI = async (location, tripType, isRetry = false) => {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second delay between retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`AI attempt ${attempt}/${maxRetries} for ${location} ${tripType}`);

      let prompt;
      if (isRetry) {
        // More aggressive prompt for retries
        prompt = `You are a travel route planner. Generate waypoints for a ${tripType} route around ${location}.

! CRITICAL WARNING: Your previous attempt generated waypoints in a STRAIGHT LINE. This is FORBIDDEN! 🚨🚨🚨

You MUST create waypoints that are SPREAD OUT across the area, not in a straight line!

REQUIREMENTS:
- Generate 8-15 waypoints (logical stops along the journey)
- Each waypoint should represent a meaningful location (landmark, turn, rest point, etc.)
- Waypoints should be SPREAD OUT logically across the area
- Each consecutive waypoint should have DIFFERENT lat/lng changes
- NO uniform increments between waypoints
- For CYCLING: Include landmarks, intersections, parks, viewpoints
- For HIKING: Include trailheads, viewpoints, rest areas, landmarks
-All waypoints must be located on accessible paths or streets
-for hiking. Do not place points in lakes, rivers, or buildings.


EXAMPLE of GOOD waypoints (spread out, varied coordinates):
{
  "waypoints": [
    {"lat": 41.3851, "lng": 2.1734, "name": "Start - Montjuïc Hill"},
    {"lat": 41.3942, "lng": 2.1734, "name": "Mirador de l'Alcalde"},
    {"lat": 41.3955, "lng": 2.1695, "name": "Jardins de Laribal"},
    {"lat": 41.3968, "lng": 2.1656, "name": "Casa Museu Amatller"},
    {"lat": 41.3982, "lng": 2.1617, "name": "Park Güell Entrance"},
    {"lat": 41.3995, "lng": 2.1578, "name": "Park Güell Viewpoint"},
    {"lat": 41.4008, "lng": 2.1540, "name": "Tibidabo Hill"},
    {"lat": 41.4021, "lng": 2.1502, "name": "Sagrada Família Viewpoint"},
    {"lat": 41.4034, "lng": 2.1464, "name": "End - City Center"}
  ]
}

EXAMPLE of BAD waypoints (straight line - FORBIDDEN):
{
  "waypoints": [
    {"lat": 41.3851, "lng": 2.1734, "name": "Start"},
    {"lat": 41.3853, "lng": 2.1714, "name": "Point 2"},
    {"lat": 41.3845, "lng": 2.1693, "name": "Point 3"}
  ]
}

Required JSON structure:
{
  "waypoints": [
    {"lat": 40.7128, "lng": -74.0060, "name": "Start - City Center"},
    {"lat": 40.7130, "lng": -74.0058, "name": "Main Street & 5th Ave"}
  ]
}

For cycling: 2-day route, up to 60 km per day (max 120 km total), does NOT need to end where it started.
For hiking: 1-day CIRCULAR route (must end where it started), 5–15 km total distance.
All numbers must be valid JSON numbers (no strings)
Include exactly the fields shown above`;
      } else {
        // Standard prompt for first attempt
        prompt = `You are a travel route planner. Generate waypoints for a ${tripType} route around ${location}.

 CRITICAL: You MUST generate waypoints that are SPREAD OUT and NOT in a straight line! 🚨

STRATEGY: Generate logical waypoints that represent meaningful stops along a realistic journey.

STEP 1: Plan a logical journey with 8-15 waypoints:
- For CYCLING: Include landmarks, intersections, parks, viewpoints, rest stops
- For HIKING: Include trailheads, viewpoints, rest areas, landmarks, scenic points

STEP 2: Generate realistic GPS coordinates for each waypoint.

IMPORTANT: Each waypoint should have DIFFERENT lat/lng changes. Do NOT use uniform increments!

EXAMPLE of GOOD waypoints (spread out, varied coordinates):
{
  "waypoints": [
    {"lat": 41.3851, "lng": 2.1734, "name": "Start - Montjuïc Hill"},
    {"lat": 41.3942, "lng": 2.1734, "name": "Mirador de l'Alcalde"},
    {"lat": 41.3955, "lng": 2.1695, "name": "Jardins de Laribal"},
    {"lat": 41.3968, "lng": 2.1656, "name": "Casa Museu Amatller"},
    {"lat": 41.3982, "lng": 2.1617, "name": "Park Güell Entrance"},
    {"lat": 41.3995, "lng": 2.1578, "name": "Park Güell Viewpoint"},
    {"lat": 41.4008, "lng": 2.1540, "name": "Tibidabo Hill"},
    {"lat": 41.4021, "lng": 2.1502, "name": "Sagrada Família Viewpoint"},
    {"lat": 41.4034, "lng": 2.1464, "name": "End - City Center"}
  ]
}

EXAMPLE of BAD waypoints (straight line - FORBIDDEN):
{
  "waypoints": [
    {"lat": 41.3851, "lng": 2.1734, "name": "Start"},
    {"lat": 41.3853, "lng": 2.1714, "name": "Point 2"},
    {"lat": 41.3845, "lng": 2.1693, "name": "Point 3"}
  ]
}

Required JSON structure:
{
  "waypoints": [
    {"lat": 40.7128, "lng": -74.0060, "name": "Start - City Center"},
    {"lat": 40.7130, "lng": -74.0058, "name": "Main Street & 5th Ave"}
  ]
}

REQUIREMENTS:
- Generate 8-15 waypoints (logical stops along the journey)
- Each waypoint should represent a meaningful location
- Waypoints should be SPREAD OUT logically across the area
- Each consecutive waypoint should have DIFFERENT lat/lng changes
- NO uniform increments between waypoints
- For cycling: 2-day route, up to 60 km per day (max 120 km total), does NOT need to end where it started.
- For hiking: 1-day CIRCULAR route (must end where it started), 5–15 km total distance.
- All numbers must be valid JSON numbers (no strings)
- Include exactly the fields shown above`;
      }

      const response = await groq.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a JSON-only response assistant. Always respond with valid JSON only, no explanations.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1, // Very low temperature for consistent JSON
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content?.trim();

      if (!content) {
        console.error(`Attempt ${attempt}: Empty response from LLM`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        return null;
      }

      // Try multiple JSON extraction methods
      let routeData = null;

      // Method 1: Direct JSON parse
      try {
        routeData = JSON.parse(content);
        console.log(`Attempt ${attempt}: Direct JSON parse successful`);
        return routeData;
      } catch (e) {
        console.log(`Attempt ${attempt}: Direct parse failed, trying extraction...`);
      }

      // Method 2: Extract JSON using regex
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          routeData = JSON.parse(jsonMatch[0]);
          console.log(`Attempt ${attempt}: Regex extraction successful`);
          return routeData;
        } catch (e) {
          console.log(`Attempt ${attempt}: Regex extraction failed`);
        }
      }

      // Method 3: Try to fix common JSON issues
      try {
        const fixedContent = content
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays

        routeData = JSON.parse(fixedContent);
        console.log(`Attempt ${attempt}: Fixed JSON parse successful`);
        return routeData;
      } catch (e) {
        console.log(`Attempt ${attempt}: Fixed parse failed`);
      }

      console.error(`Attempt ${attempt}: All JSON parsing methods failed`);
      console.error('Raw response:', content.substring(0, 200) + '...');

      // Wait before next attempt
      if (attempt < maxRetries) {
        console.log(`Waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

    } catch (error) {
      console.error(`Attempt ${attempt} failed with error:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error(`All ${maxRetries} AI attempts failed for ${location} ${tripType}`);
  return null;
};

// Validate waypoints and ensure they're not in a straight line
const isWaypointsValid = (waypoints) => {
  console.log('Validating waypoints:', waypoints?.length, 'waypoints');

  if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 3) {
    console.log('Waypoints validation failed: not an array or too few waypoints');
    return false;
  }

  // Waypoints should be in reasonable range (not in ocean, not at 0,0)
  const allValid = waypoints.every((wp, index) => {
    const isValid = (
      typeof wp.lat === 'number' &&
      typeof wp.lng === 'number' &&
      Math.abs(wp.lat) <= 90 &&
      Math.abs(wp.lng) <= 180 &&
      !(Math.abs(wp.lat) < 0.5 && Math.abs(wp.lng) < 0.5) // Not 0,0
    );

    if (!isValid) {
      console.log(`Waypoint ${index} validation failed:`, wp);
    }

    return isValid;
  });

  if (!allValid) {
    console.log('Waypoints validation failed: invalid coordinates');
    return false;
  }

  // Check if waypoints are NOT in a straight line
  const isNotStraight = !isStraightLine(waypoints);
  if (!isNotStraight) {
    console.log('Waypoints validation failed: waypoints are in a straight line');
  }

  return isNotStraight;
};

// Check if points form a straight line (which we want to avoid)
const isStraightLine = (points) => {
  if (points.length < 3) return false;

  let straightAngles = 0;
  let totalAngles = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // וקטורים
    const v1 = { x: curr.lat - prev.lat, y: curr.lng - prev.lng };
    const v2 = { x: next.lat - curr.lat, y: next.lng - curr.lng };

    // אורך וקטורים
    const len1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
    const len2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);

    if (len1 === 0 || len2 === 0) continue; // מדלגים על נקודות כפולות

    // קוסינוס של הזווית בין הווקטורים
    const dot = v1.x * v2.x + v1.y * v2.y;
    const cosTheta = dot / (len1 * len2);

    // נורמליזציה כדי למנוע בעיות עיגול
    const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);

    totalAngles++;

    // נחשיב זוויות מעל 170° כקו ישר
    if (angle > 170) {
      straightAngles++;
    }
  }

  // אם יותר מ-70% מהזוויות קרובות ל-180°, המסלול כמעט ישר
  return totalAngles > 0 && straightAngles / totalAngles > 0.7;
};


module.exports = {
  planTrip
}; 