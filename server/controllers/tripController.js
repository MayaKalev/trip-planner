const { getWeatherForecast } = require('./weatherController');
const { asyncHandler } = require('../middleware/errorHandler');
const Groq = require('groq-sdk');
const axios = require('axios');

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @desc    Generate trip route with AI
// @route   POST /api/trip/plan
// @access  Private
const planTrip = asyncHandler(async (req, res) => {
  let { location, tripType } = req.body;


  console.log("📥 Received request body:", req.body);
  console.log('🔹 Location (full):', req.body.location);
  console.log("🔹 Location type:", typeof location);
  console.log("🔹 Location content:", location);

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

    res.json({
      success: true,
      data: { route: routeData, weather: weatherData },
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
    if (tripType === 'cycling' && coordinates.length > 1) {
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
      elevation: true,
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
          elevation: {
            gain: (properties.ascent || 0) * day1Frac,
            loss: (properties.descent || 0) * day1Frac
          },
          points: points.filter(p => p.day === 1)
        },
        {
          day: 2,
          distance: day2Meters / 1000,
          duration: (totalSec * day2Frac) / 3600,
          elevation: {
            gain: (properties.ascent || 0) * day2Frac,
            loss: (properties.descent || 0) * day2Frac
          },
          points: points.filter(p => p.day === 2)
        }
      ]
      : [
        {
          day: 1,
          distance: totalMeters / 1000,
          duration: totalSec / 3600,
          elevation: { gain: properties.ascent || 0, loss: properties.descent || 0 },
          points
        }
      ];

    // --- ההחזרה ---
    return {
      geometry,
      points,
      dailyRoutes,
      totalDistance: totalMeters / 1000,
      totalDuration: totalSec / 3600,
      totalElevation: {
        gain: properties.ascent || 0,
        loss: properties.descent || 0
      }
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

For cycling: 2-day route, 40-80km total distance
For hiking: 1-day circular route, 5-15km total distance
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
- For cycling: 2-day route, 40-80km total distance
- For hiking: 1-day circular route, 5-15km total distance
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


// Fallback simulation route generation with logical path structure
const generateSimulatedRoute = (location, tripType) => {
  const baseCoordinates = {
    'Paris, France': { lat: 48.8566, lng: 2.3522 },
    'London, UK': { lat: 51.5074, lng: -0.1278 },
    'New York, USA': { lat: 40.7128, lng: -74.0060 },
    'Tokyo, Japan': { lat: 35.6762, lng: 139.6503 },
    'Sydney, Australia': { lat: -33.8688, lng: 151.2093 },
    'Rome, Italy': { lat: 41.9028, lng: 12.4964 },
    'Barcelona, Spain': { lat: 41.3851, lng: 2.1734 },
    'Amsterdam, Netherlands': { lat: 52.3676, lng: 4.9041 },
    'Berlin, Germany': { lat: 52.5200, lng: 13.4050 },
    'Prague, Czech Republic': { lat: 50.0755, lng: 14.4378 }
  };

  const baseCoord = baseCoordinates[location] || { lat: 40.7128, lng: -74.0060 };
  const points = [];
  const dailyRoutes = [];

  if (tripType === 'cycling') {
    // Generate 2-day cycling route with logical path structure
    const dailyDistance = 45 + Math.random() * 30;
    const totalDistance = dailyDistance * 2;

    for (let day = 1; day <= 2; day++) {
      const dayPoints = [];
      const numPoints = 35; // Fixed 35 points for logical structure

      // Create logical cycling path with realistic road following
      let currentLat = baseCoord.lat + (day - 1) * 0.05;
      let currentLng = baseCoord.lng + (day - 1) * 0.05;
      let direction = Math.random() * Math.PI * 2; // Random starting direction

      for (let i = 0; i < numPoints; i++) {
        const progress = i / (numPoints - 1);

        // Logical path segments with realistic road behavior
        let latOffset = 0;
        let lngOffset = 0;

        if (i < 8) {
          // Segment 1: Main road straight
          latOffset = Math.cos(direction) * 0.002;
          lngOffset = Math.sin(direction) * 0.002;
        } else if (i < 15) {
          // Segment 2: Turn right
          direction += 0.3;
          latOffset = Math.cos(direction) * 0.002;
          lngOffset = Math.sin(direction) * 0.002;
        } else if (i < 22) {
          // Segment 3: Follow curved road
          direction += Math.sin(progress * Math.PI) * 0.1;
          latOffset = Math.cos(direction) * 0.002;
          lngOffset = Math.sin(direction) * 0.002;
        } else if (i < 28) {
          // Segment 4: Turn left
          direction -= 0.4;
          latOffset = Math.cos(direction) * 0.002;
          lngOffset = Math.sin(direction) * 0.002;
        } else {
          // Segment 5: Return route
          direction += 0.2;
          latOffset = Math.cos(direction) * 0.002;
          lngOffset = Math.sin(direction) * 0.002;
        }

        // Add small random variations for realism
        latOffset += (Math.random() - 0.5) * 0.0005;
        lngOffset += (Math.random() - 0.5) * 0.0005;

        currentLat += latOffset;
        currentLng += lngOffset;

        dayPoints.push({
          lat: currentLat,
          lng: currentLng,
          day,
          order: i
        });
      }

      points.push(...dayPoints);
      dailyRoutes.push({
        day,
        distance: dailyDistance,
        duration: dailyDistance / 15,
        elevation: { gain: Math.random() * 500, loss: Math.random() * 500 },
        points: dayPoints
      });
    }

    return {
      geometry,
      points,
      dailyRoutes,
      totalDistance,
      totalDuration: totalDistance / 15,
      totalElevation: {
        gain: dailyRoutes.reduce((sum, day) => sum + day.elevation.gain, 0),
        loss: dailyRoutes.reduce((sum, day) => sum + day.elevation.loss, 0)
      }
    };
  } else {
    // Generate hiking route with logical trail structure
    const dailyDistance = 8 + Math.random() * 7;
    const numPoints = 35; // Fixed 35 points for logical structure
    const radius = 0.008;

    // Create logical hiking trail with realistic terrain following
    let currentAngle = 0;
    const centerLat = baseCoord.lat;
    const centerLng = baseCoord.lng;
    let trailDirection = 0;

    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);

      // Logical trail segments with realistic terrain following
      let angleChange = 0;
      let radiusChange = 1;

      if (i < 8) {
        // Segment 1: Main trail uphill
        angleChange = 0.1;
        radiusChange = 0.8 + progress * 0.4;
      } else if (i < 15) {
        // Segment 2: Ridge trail
        angleChange = 0.05;
        radiusChange = 1.2;
      } else if (i < 22) {
        // Segment 3: Descend into valley
        angleChange = -0.15;
        radiusChange = 1.0;
      } else if (i < 28) {
        // Segment 4: Cross valley and climb
        angleChange = 0.2;
        radiusChange = 0.9;
      } else {
        // Segment 5: Return to trailhead
        angleChange = -0.1;
        radiusChange = 0.7;
      }

      trailDirection += angleChange;
      currentAngle += (2 * Math.PI / numPoints) + trailDirection * 0.1;

      const currentRadius = radius * radiusChange;
      const latOffset = Math.cos(currentAngle) * currentRadius;
      const lngOffset = Math.sin(currentAngle) * currentRadius;

      // Add terrain variations
      const terrainVariation = Math.sin(progress * Math.PI * 3) * 0.001;
      const naturalVariation = (Math.random() - 0.5) * 0.0005;

      points.push({
        lat: centerLat + latOffset + terrainVariation + naturalVariation,
        lng: centerLng + lngOffset + terrainVariation + naturalVariation,
        day: 1,
        order: i
      });
    }

    return {
      points,
      dailyRoutes: [{
        day: 1,
        distance: dailyDistance,
        duration: dailyDistance / 4,
        elevation: { gain: Math.random() * 300, loss: Math.random() * 300 },
        points
      }],
      totalDistance: dailyDistance,
      totalDuration: dailyDistance / 4,
      totalElevation: { gain: Math.random() * 300, loss: Math.random() * 300 }
    };
  }
};

// Helper function to get real 3-day weather forecast by coordinates
const getWeatherData = async (startLat, startLng) => {
  try {
    if (!process.env.WEATHER_API_KEY) {
      console.error('❌ WEATHER_API_KEY not set');
      return { forecast: [] };
    }

    console.log(`🔹 Fetching weather for coordinates: ${startLat}, ${startLng}`);

    // Fetch 3-day forecast (8 records per day, every 3 hours)
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast`,
      {
        params: {
          lat: startLat,
          lon: startLng,
          appid: process.env.WEATHER_API_KEY,
          units: 'metric',
          cnt: 24
        }
      }
    );

    if (!response.data || !response.data.list) {
      console.error('❌ OpenWeatherMap returned empty response');
      return { forecast: [] };
    }

    const forecastData = response.data.list;
    const forecasts = [];
    const dailyData = {};

    // Group forecasts by day
    forecastData.forEach(forecast => {
      const date = new Date(forecast.dt * 1000);
      const dayKey = date.toISOString().split('T')[0];

      if (!dailyData[dayKey]) {
        dailyData[dayKey] = {
          date: date,
          temperatures: [],
          descriptions: [],
          icons: [],
          humidity: [],
          windSpeed: [],
          precipitation: []
        };
      }

      dailyData[dayKey].temperatures.push(forecast.main.temp);
      dailyData[dayKey].descriptions.push(forecast.weather[0].description);
      dailyData[dayKey].icons.push(forecast.weather[0].icon);
      dailyData[dayKey].humidity.push(forecast.main.humidity);
      dailyData[dayKey].windSpeed.push(forecast.wind.speed);
      dailyData[dayKey].precipitation.push(forecast.pop * 100);
    });

    // Take the next 3 days starting from tomorrow
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    Object.keys(dailyData)
      .filter(dayKey => new Date(dayKey) >= tomorrow)
      .slice(0, 3)
      .forEach(dayKey => {
        const day = dailyData[dayKey];
        forecasts.push({
          date: day.date,
          temperature: {
            min: Math.min(...day.temperatures),
            max: Math.max(...day.temperatures),
            current: day.temperatures[0]
          },
          description: getMostFrequent(day.descriptions),
          icon: day.icons[0],
          humidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
          windSpeed: Math.round(day.windSpeed.reduce((a, b) => a + b, 0) / day.windSpeed.length * 10) / 10,
          precipitation: Math.round(day.precipitation.reduce((a, b) => a + b, 0) / day.precipitation.length)
        });
      });

    console.log('✅ 3-day weather forecast ready:', forecasts);
    return { forecast: forecasts };

  } catch (error) {
    console.error('❌ Weather data error:', error.message);
    return { forecast: [] };
  }
};

// Helper function to get the most frequent description
const getMostFrequent = (arr) => {
  const frequency = {};
  let maxFreq = 0;
  let mostFrequent = arr[0];

  arr.forEach(item => {
    frequency[item] = (frequency[item] || 0) + 1;
    if (frequency[item] > maxFreq) {
      maxFreq = frequency[item];
      mostFrequent = item;
    }
  });

  return mostFrequent;
};




// Helper function to generate route image
const generateRouteImage = async (location) => {
  // Simulate image generation
  // In real implementation, this would call an image generation service

  const imageUrls = {
    'Paris, France': 'https://images.unsplash.com/photo-1502602898534-47d1c0c0b0e3?w=800',
    'London, UK': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800',
    'New York, USA': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800',
    'Tokyo, Japan': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
    'Sydney, Australia': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800',
    'Rome, Italy': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
    'Barcelona, Spain': 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800',
    'Amsterdam, Netherlands': 'https://images.unsplash.com/photo-1512470876302-972faa02aa51?w=800',
    'Berlin, Germany': 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800',
    'Prague, Czech Republic': 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800'
  };

  return {
    url: imageUrls[location] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    alt: `${location} landscape`
  };
};

module.exports = {
  planTrip
}; 