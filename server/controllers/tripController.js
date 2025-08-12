
const { getWeatherData } = require('./weatherController');
const { asyncHandler } = require('../middleware/errorHandler');
const { fetchImageByLocation } = require('../controllers/imageController');
const Groq = require('groq-sdk');
const axios = require('axios');

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CYCLING_MAX_KM_PER_DAY = Number(process.env.CYCLING_MAX_KM_PER_DAY ?? 60);
const HIKING_MIN_KM = Number(process.env.HIKING_MIN_KM ?? 5);
const HIKING_MAX_KM = Number(process.env.HIKING_MAX_KM ?? 15);
const SNAP_RADII = [200, 400, 800];
const MIN_WPS_AFTER_SNAP = 3;
const LOOP_CLOSE_METERS = 120;

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


function decimateLonLat(coords, keepEvery = 2) {
  if (!Array.isArray(coords) || coords.length <= 2) return coords;
  const out = [];
  for (let i = 0; i < coords.length; i++) {
    if (i === 0 || i === coords.length - 1 || i % keepEvery === 0) out.push(coords[i]);
  }
  return out;
}


function ensureLoop(coords) {
  if (!coords || coords.length < 2) return coords;
  const start = coords[0];
  const end = coords[coords.length - 1];
  const d = haversineMetersLonLat(start, end);
  if (d > LOOP_CLOSE_METERS) coords.push(start);
  return coords;
}


const planTrip = asyncHandler(async (req, res) => {
  let { location, tripType } = req.body;


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
      data: {
        route: routeData,
        weather: weatherData,
        image: imageData
      },
    });
  } catch (error) {
    console.error('Trip planning error:', error);
    res.status(500).json({ success: false, message: 'Failed to plan trip' });
  }
});

const generateRoute = async (location, tripType) => {
  const maxAiAttempts = 6;

  for (let attempt = 1; attempt <= maxAiAttempts; attempt++) {
    console.log(`AI waypoint generation attempt ${attempt}/${maxAiAttempts} for ${location} ${tripType}`);

    const isRetry = attempt > 1;
    const waypointsResponse = await generateRouteWithAI(location, tripType, isRetry);

    if (!waypointsResponse || !Array.isArray(waypointsResponse.waypoints)) {
      console.log(`AI attempt ${attempt} produced invalid payload; retrying...`);
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    if (!isWaypointsValid(waypointsResponse.waypoints)) {
      console.log(`AI attempt ${attempt}: waypoints invalid (straight line / bad coords); retrying...`);
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    console.log(`AI waypoint generation successful - ${waypointsResponse.waypoints.length} waypoints`);

    try {
      const apiKey = process.env.OPENROUTESERVICE_API_KEY;
      if (apiKey) console.log('🔑 ORS Key preview:', apiKey.slice(0, 5) + '...' + apiKey.slice(-3));

      const route = await generateRouteWithOpenRouteService(waypointsResponse.waypoints, tripType);
      console.log(`OpenRouteService route generation successful - ${route.points.length} points`);
      return route;
    } catch (orsError) {
      console.warn(`OpenRouteService failed: ${orsError.message} — retrying with new AI waypoints...`);
      await new Promise(r => setTimeout(r, 900));
      continue; 
    }
  }

  throw new Error("AI failed to generate realistic waypoints after multiple attempts.");
};


const snapWaypoints = async (waypoints, tripType) => {
  const profile = tripType === 'cycling' ? 'cycling-regular' : 'foot-hiking';
  const locs = waypoints.map(wp => [wp.lng, wp.lat]); // [[lon,lat]]

  let lastErr = null;

  for (const radius of SNAP_RADII) {
    try {
      const { data } = await axios.post(
        `https://api.openrouteservice.org/v2/snap/${profile}/json`,
        { locations: locs, radius },
        {
          headers: {
            Authorization: process.env.OPENROUTESERVICE_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          timeout: 20000
        }
      );

      const raw = (data?.locations || []).map(item => item?.location || null);
      const filtered = raw.filter(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));

      const deduped = [];
      for (const c of filtered) {
        const ok = deduped.every(prev => haversineMetersLonLat(prev, c) > 30);
        if (ok) deduped.push(c);
      }

      if (deduped.length >= MIN_WPS_AFTER_SNAP) {
        return deduped; 
      }

      console.warn(`Snap with radius=${radius}m returned only ${deduped.length} usable points; trying larger radius...`);
    } catch (error) {
      lastErr = error;
      console.error(
        'Snap API error:',
        error.response?.status,
        JSON.stringify(error.response?.data || { message: error.message }, null, 2)
      );

    }
  }


  throw new Error(`Snap failed: too few snapped waypoints (< ${MIN_WPS_AFTER_SNAP})`);
};

function cumulativeMeters(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum[i] = cum[i - 1] + haversineMetersLonLat(coords[i - 1], coords[i]);
  }
  return cum;
}
function pickMidIndexByRadius(locs, start, targetMeters) {
  let bestIdx = 1, bestDiff = Infinity;
  for (let i = 1; i < locs.length; i++) {
    const d = haversineMetersLonLat(start, locs[i]);
    const diff = Math.abs(d - targetMeters);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

const generateRouteWithOpenRouteService = async (waypoints, tripType) => {
  try {
    console.log(`Generating route with OpenRouteService for ${tripType} with ${waypoints.length} waypoints`);

    const snapped = await snapWaypoints(waypoints, tripType); // [[lon,lat], ...]

    const originalSnapped = [...snapped];


    let coordinates = (tripType === 'hiking')
      ? ensureLoop([...snapped])
      : [...snapped];


    const buildRoute = async (coords) => {
      const profile = tripType === 'cycling' ? 'cycling-regular' : 'foot-hiking';
      const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

      const baseBody = {
        coordinates: coords,
        instructions: true,
        extra_info: ['waytype', 'steepness', 'surface'],
        geometry_simplify: false
      };
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

      if (!response.data?.features?.length) {
        throw new Error('No route found');
      }
      return response.data.features[0];
    };

    let feature = await buildRoute(coordinates);


    const readDistanceSec = (feat) => {
      const coords = feat.geometry.coordinates;
      const props = feat.properties || {};
      let meters = props.summary?.distance ?? 0;
      let seconds = props.summary?.duration ?? 0;
      if (!meters) {
        let acc = 0;
        for (let i = 1; i < coords.length; i++) acc += haversineMetersLonLat(coords[i - 1], coords[i]);
        meters = acc;
      }
      return { meters, seconds };
    };

    let { meters: totalMeters, seconds: totalSec } = readDistanceSec(feature);
    let distanceKm = totalMeters / 1000;

    if (tripType === 'cycling') {
      // ==== אופניים: שני ימים רציפים, עד 60 ק״מ ליום ====
      if (distanceKm > CYCLING_MAX_KM_PER_DAY * 2) {
        for (const k of [2, 3]) {
          console.warn(`Cycling ${distanceKm.toFixed(1)} km > ${CYCLING_MAX_KM_PER_DAY*2} km, decimate keepEvery=${k}...`);
          const decimated = decimateLonLat(coordinates, k);
          feature = await buildRoute(decimated);
          ({ meters: totalMeters, seconds: totalSec } = readDistanceSec(feature));
          distanceKm = totalMeters / 1000;
          if (distanceKm <= CYCLING_MAX_KM_PER_DAY * 2) break;
        }
      }
      if (distanceKm > CYCLING_MAX_KM_PER_DAY * 2) {
        throw new Error(`Cycling route too long: ${distanceKm.toFixed(1)} km (max ${CYCLING_MAX_KM_PER_DAY*2} km total).`);
      }


      const coords = feature.geometry.coordinates;
      const cum = cumulativeMeters(coords);

      let day1TargetKm = distanceKm / 2;
      if (day1TargetKm > CYCLING_MAX_KM_PER_DAY) day1TargetKm = CYCLING_MAX_KM_PER_DAY;
      if ((distanceKm - day1TargetKm) > CYCLING_MAX_KM_PER_DAY) {
        day1TargetKm = distanceKm - CYCLING_MAX_KM_PER_DAY;
      }
      if (day1TargetKm < 0) day1TargetKm = Math.max(0, distanceKm - CYCLING_MAX_KM_PER_DAY);

      const day1TargetM = day1TargetKm * 1000;
      let splitIdx = 1;
      for (let i = 1; i < cum.length; i++) {
        if (cum[i] >= day1TargetM) { splitIdx = i; break; }
      }

      const day1Meters = cum[splitIdx];
      const day2Meters = totalMeters - day1Meters;

      const points = coords.map(([lon, lat], i) => ({
        lat, lng: lon, day: (i <= splitIdx ? 1 : 2), order: i
      }));

      const dailyRoutes = [
        {
          day: 1,
          distance: day1Meters / 1000,
          duration: (totalSec * (day1Meters / Math.max(totalMeters, 1))) / 3600,
          points: points.filter(p => p.day === 1)
        },
        {
          day: 2,
          distance: day2Meters / 1000,
          duration: (totalSec * (day2Meters / Math.max(totalMeters, 1))) / 3600,
          points: points.filter(p => p.day === 2)
        }
      ];

      if (dailyRoutes[0].distance > CYCLING_MAX_KM_PER_DAY + 0.1 || dailyRoutes[1].distance > CYCLING_MAX_KM_PER_DAY + 0.1) {
        throw new Error(
          `Cycling day distance exceeded 60 km (day1=${dailyRoutes[0].distance.toFixed(1)}, day2=${dailyRoutes[1].distance.toFixed(1)}).`
        );
      }

      return {
        geometry: feature.geometry,
        points,
        dailyRoutes,
        totalDistance: totalMeters / 1000,
        totalDuration: totalSec / 3600
      };
    } else {

      if (distanceKm > HIKING_MAX_KM) {
      
        for (const k of [2, 3]) {
          console.warn(`Hiking ${distanceKm.toFixed(1)} km > ${HIKING_MAX_KM} km, decimate keepEvery=${k}...`);
          const decimated = ensureLoop(decimateLonLat(coordinates, k));
          feature = await buildRoute(decimated);
          ({ meters: totalMeters, seconds: totalSec } = readDistanceSec(feature));
          distanceKm = totalMeters / 1000;
          if (distanceKm <= HIKING_MAX_KM) break;
        }
      }

      if (distanceKm > HIKING_MAX_KM) {

        const fracs = [0.55, 0.45, 0.35];
        for (const frac of fracs) {
          const maxMeters = HIKING_MAX_KM * 1000 * frac;
          const cumSnap = cumulativeMeters(originalSnapped);
          let j = 1;
          for (let i = 1; i < cumSnap.length; i++) {
            if (cumSnap[i] >= maxMeters) { j = i; break; }
            j = i;
          }
          const sliced = ensureLoop(originalSnapped.slice(0, Math.max(2, j + 1)));
          feature = await buildRoute(sliced);
          ({ meters: totalMeters, seconds: totalSec } = readDistanceSec(feature));
          distanceKm = totalMeters / 1000;
          console.warn(`Hiking prefix ${Math.round(frac*100)}% → ${distanceKm.toFixed(1)} km`);
          if (distanceKm <= HIKING_MAX_KM) break;
        }
      }

      if (distanceKm > HIKING_MAX_KM) {

        const start = originalSnapped[0];
        const targetRadiusM = (HIKING_MAX_KM * 1000) / (2 * Math.PI) * 0.9; 
        const midIdx = pickMidIndexByRadius(originalSnapped, start, targetRadiusM);
        const candidate = ensureLoop([start, originalSnapped[midIdx]]);
        feature = await buildRoute(candidate);
        ({ meters: totalMeters, seconds: totalSec } = readDistanceSec(feature));
        distanceKm = totalMeters / 1000;
        console.warn(`Hiking minimal loop → ${distanceKm.toFixed(1)} km`);
      }

      if (distanceKm < HIKING_MIN_KM || distanceKm > HIKING_MAX_KM) {
        throw new Error(`Hiking route distance ${distanceKm.toFixed(1)} km out of range (${HIKING_MIN_KM}–${HIKING_MAX_KM} km).`);
      }

      const outPoints = feature.geometry.coordinates.map(([lon, lat], i) => ({
        lat, lng: lon, day: 1, order: i
      }));

      const dailyRoutes = [
        {
          day: 1,
          distance: totalMeters / 1000,
          duration: totalSec / 3600,
          points: outPoints
        }
      ];

      return {
        geometry: feature.geometry,
        points: outPoints,
        dailyRoutes,
        totalDistance: totalMeters / 1000,
        totalDuration: totalSec / 3600
      };
    }

  } catch (error) {
    console.error(
      'OpenRouteService error:',
      error.response?.status,
      JSON.stringify(error.response?.data || { message: error.message }, null, 2)
    );
    throw new Error(`Failed to generate route with OpenRouteService: ${error.message}`);
  }
};



const generateRouteWithAI = async (location, tripType, isRetry = false) => {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`AI attempt ${attempt}/${maxRetries} for ${location} ${tripType}`);

 
      const commonRules = `
REQUIREMENTS (critical):
- Generate 8-15 waypoints (logical stops/turns)
- Each waypoint MUST be on accessible streets/paths (no water/lakes/rivers/buildings)
- Spread out logically across the area (NOT a straight line)
- Each consecutive waypoint must vary in lat/lng (no uniform increments)
- Return **JSON only** with the exact fields: {"waypoints":[{"lat":<num>,"lng":<num>,"name":"..."}]}
`;

      const cyclingSpec = `
For CYCLING:
- A **2-day** city-to-city journey (start and end should be **different** areas/cities)
- **Not circular**
- Up to **${CYCLING_MAX_KM_PER_DAY} km per day** (max ${CYCLING_MAX_KM_PER_DAY * 2} km total)
`;

      const hikingSpec = `
For HIKING:
- **1-day CIRCULAR** route (must end where it started)
- Total distance **${HIKING_MIN_KM}–${HIKING_MAX_KM} km**
`;

      const basePrompt = `
You are a travel route planner. Generate waypoints for a ${tripType} route around ${location}.
${commonRules}
${tripType === 'cycling' ? cyclingSpec : hikingSpec}
Example of GOOD waypoints (varied, realistic):
{"waypoints":[{"lat":41.3851,"lng":2.1734,"name":"Start - City Center"},{"lat":41.3942,"lng":2.1734,"name":"Viewpoint"},{"lat":41.3968,"lng":2.1656,"name":"Park Entrance"}]}
`;

      const retryNote = isRetry ? `
!!! PREVIOUS ATTEMPT HAD ISSUES. FIX THEM NOW:
- Do NOT place points over water or off-network
- Ensure spread-out, realistic points
- For cycling: start and end different cities/areas; for hiking: circular
`: '';

      const prompt = basePrompt + retryNote;

      const response = await groq.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a JSON-only response assistant. Always respond with valid JSON only, no explanations.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
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

      // Parse robustly
      let routeData = null;

      try {
        routeData = JSON.parse(content);
        console.log(`Attempt ${attempt}: Direct JSON parse successful`);
        return routeData;
      } catch (e) {
        console.log(`Attempt ${attempt}: Direct parse failed, trying extraction...`);
      }

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

      try {
        const fixed = content
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        routeData = JSON.parse(fixed);
        console.log(`Attempt ${attempt}: Fixed JSON parse successful`);
        return routeData;
      } catch (e) {
        console.log(`Attempt ${attempt}: Fixed parse failed`);
      }

      console.error(`Attempt ${attempt}: All JSON parsing methods failed`);
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


const isWaypointsValid = (waypoints) => {
  console.log('Validating waypoints:', waypoints?.length, 'waypoints');

  if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 3) {
    console.log('Waypoints validation failed: not an array or too few waypoints');
    return false;
  }

  const allValid = waypoints.every((wp, index) => {
    const isValid = (
      typeof wp.lat === 'number' &&
      typeof wp.lng === 'number' &&
      Math.abs(wp.lat) <= 90 &&
      Math.abs(wp.lng) <= 180 &&
      !(Math.abs(wp.lat) < 0.5 && Math.abs(wp.lng) < 0.5)
    );
    if (!isValid) console.log(`Waypoint ${index} validation failed:`, wp);
    return isValid;
  });

  if (!allValid) {
    console.log('Waypoints validation failed: invalid coordinates');
    return false;
  }


  const isNotStraight = !isStraightLine(waypoints);
  if (!isNotStraight) {
    console.log('Waypoints validation failed: waypoints are in a straight line');
  }

  return isNotStraight;
};


const isStraightLine = (points) => {
  if (points.length < 3) return false;

  let straightAngles = 0;
  let totalAngles = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1 = { x: curr.lat - prev.lat, y: curr.lng - prev.lng };
    const v2 = { x: next.lat - curr.lat, y: next.lng - curr.lng };

    const len1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
    const len2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);

    if (len1 === 0 || len2 === 0) continue;

    const dot = v1.x * v2.x + v1.y * v2.y;
    const cosTheta = dot / (len1 * len2);

    const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);

    totalAngles++;
    if (angle > 170) straightAngles++;
  }

  return totalAngles > 0 && straightAngles / totalAngles > 0.7;
};

module.exports = {
  planTrip
};