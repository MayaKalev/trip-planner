const { asyncHandler } = require('../middleware/errorHandler');
const { fetchImageByLocation } = require('../controllers/imageController');
const Groq = require('groq-sdk');
const axios = require('axios');

// Groq client — used to generate waypoints via an LLM
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Configuration parameters with safe defaults
const CYCLING_MAX_KM_PER_DAY = Number(process.env.CYCLING_MAX_KM_PER_DAY ?? 60);
const HIKING_MIN_KM = Number(process.env.HIKING_MIN_KM ?? 5);
const HIKING_MAX_KM = Number(process.env.HIKING_MAX_KM ?? 15);
const SNAP_RADII = [200, 400, 800];          // progressively larger attempts to snap to the road network
const MIN_WPS_AFTER_SNAP = 3;                 // minimum points after snap to consider it a plausible route
const LOOP_CLOSE_METERS = 120;                // close loop if end point is farther than this from the start

// Basic geometric conversions/computations
const toRad = d => (d * Math.PI) / 180;

// Haversine distance between two [lon,lat] pairs in meters
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

// Decimate points along the path — reduces noise/overhead in coordinates before ORS requests
function decimateLonLat(coords, keepEvery = 2) {
  if (!Array.isArray(coords) || coords.length <= 2) return coords;
  const out = [];
  for (let i = 0; i < coords.length; i++) {
    if (i === 0 || i === coords.length - 1 || i % keepEvery === 0) out.push(coords[i]);
  }
  return out;
}

// Ensure a circular route by appending the start point to the end if needed (for single-day hiking)
function ensureLoop(coords) {
  if (!coords || coords.length < 2) return coords;
  const start = coords[0];
  const end = coords[coords.length - 1];
  const d = haversineMetersLonLat(start, end);
  if (d > LOOP_CLOSE_METERS) coords.push(start);
  return coords;
}

// API endpoint: trip planning — generates a route and a destination image (no weather here)
const planTrip = asyncHandler(async (req, res) => {
  let { location, tripType } = req.body;

  // Support receiving location as a JSON string (to prevent client integration issues)
  if (typeof location === 'string') {
    try {
      location = JSON.parse(location);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid location format' });
    }
  }

  const lat = Number(location?.lat);
  const lng = Number(location?.lng);

  // Safe validation for lat/lng (0 is a valid value)
  if (!location || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      success: false,
      message: 'Location with lat/lng is required',
    });
  }

  try {
    // Create route by location name and trip type — includes interaction with LLM and OpenRouteService
    const routeData = await generateRoute(location.name, tripType);

    // Try to fetch a destination image by location name (optional; has internal fallback)
    const imageData = await fetchImageByLocation(location.name);

    return res.json({
      success: true,
      data: {
        route: routeData,
        image: imageData
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to plan trip' });
  }
});

// Route generation: retry loop — first LLM waypoints, then ORS for routing
const generateRoute = async (location, tripType) => {
  const maxAiAttempts = 6;

  for (let attempt = 1; attempt <= maxAiAttempts; attempt++) {

    const isRetry = attempt > 1;
    const waypointsResponse = await generateRouteWithAI(location, tripType, isRetry);

    // Retry if no valid JSON with a waypoints array
    if (!waypointsResponse || !Array.isArray(waypointsResponse.waypoints)) {
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    // Validate waypoints (not a straight line, valid values, etc.)
    if (!isWaypointsValid(waypointsResponse.waypoints)) {
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    try {
      const apiKey = process.env.OPENROUTESERVICE_API_KEY;

      // Build the final route via ORS according to product rules (circular hike / 2-day cycling)
      const route = await generateRouteWithOpenRouteService(waypointsResponse.waypoints, tripType);
      return route;
    } catch (orsError) {
      // ORS failure: try again with a new set of AI waypoints
      console.warn(`OpenRouteService failed: ${orsError.message} — retrying with new AI waypoints...`);
      await new Promise(r => setTimeout(r, 900));
      continue; 
    }
  }

  throw new Error("AI failed to generate realistic waypoints after multiple attempts.");
};

// Snap waypoints to actual road/trail network using ORS snap service
const snapWaypoints = async (waypoints, tripType) => {
  const profile = tripType === 'cycling' ? 'cycling-regular' : 'foot-hiking';
  const locs = waypoints.map(wp => [wp.lng, wp.lat]); // ORS expects [lon,lat]

  let lastErr = null;

  // Try increasing radii to improve network match
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

      // Extract only valid coordinates
      const raw = (data?.locations || []).map(item => item?.location || null);
      const filtered = raw.filter(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));

      // Basic de-duplication based on minimum distance between adjacent points (30 m)
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

    }
  }

  // If all attempts failed — too few snapped points to build a viable route
  throw new Error(`Snap failed: too few snapped waypoints (< ${MIN_WPS_AFTER_SNAP})`);
};

// Accumulate distances between points — enables splitting by days/targets
function cumulativeMeters(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum[i] = cum[i - 1] + haversineMetersLonLat(coords[i - 1], coords[i]);
  }
  return cum;
}

// Pick a mid index by target radius from the start — useful for creating a short loop
function pickMidIndexByRadius(locs, start, targetMeters) {
  let bestIdx = 1, bestDiff = Infinity;
  for (let i = 1; i < locs.length; i++) {
    const d = haversineMetersLonLat(start, locs[i]);
    const diff = Math.abs(d - targetMeters);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

// Build a detailed route with ORS according to product rules (hiking/cycling)
const generateRouteWithOpenRouteService = async (waypoints, tripType) => {
  try {
    const snapped = await snapWaypoints(waypoints, tripType); // result: [[lon,lat], ...]
    const originalSnapped = [...snapped];

    // Hiking must be circular; cycling — not
    let coordinates = (tripType === 'hiking')
      ? ensureLoop([...snapped])
      : [...snapped];

    // Wrapper for building a route from ORS; has fallback if the 'options' parameter is unsupported
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
        // Some ORS deployments do not recognize options/avoid_features — retry without them
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

    // First request to ORS
    let feature = await buildRoute(coordinates);

    // Compute distance/time — if no summary, compute manually from coordinates
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
      // Cycling: 2-day route, up to X km per day (max 2X total)
      if (distanceKm > CYCLING_MAX_KM_PER_DAY * 2) {
        // Try decimating points before ORS to shorten the route
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

      // Split into day 1 and day 2 by cumulative distance so each day stays under the cap
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

      // Convert to client point format (lat/lng) with day assignment
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

      // Enforce per-day distance cap with a small tolerance
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
      // Hiking: single circular route within [HIKING_MIN_KM, HIKING_MAX_KM]

      // If too long — try shortening via decimation + loop closure
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

      // Still too long? Try taking only a prefix of the original snapped points
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

      // Last attempt: minimal loop based on a theoretical target radius
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

      // Must end within the defined range
      if (distanceKm < HIKING_MIN_KM || distanceKm > HIKING_MAX_KM) {
        throw new Error(`Hiking route distance ${distanceKm.toFixed(1)} km out of range (${HIKING_MIN_KM}–${HIKING_MAX_KM} km).`);
      }

      // Convert coordinates to client format (lat/lng) with day 1 assignment
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
    throw new Error(`Failed to generate route with OpenRouteService: ${error.message}`);
  }
};

// Generate waypoints using Groq (LLM) with retries and aggressive JSON fixing
const generateRouteWithAI = async (location, tripType, isRetry = false) => {
  // Use preset waypoints when available for specific locations
  const preset = getPresetWaypointsIfAny(location, tripType);
  if (preset) {
    return preset; 
  }

  const maxRetries = 3;
  const retryDelay = 1000; // milliseconds between attempts

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Strict instructions for the LLM — JSON-only format and product constraints
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
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        return null;
      }

      // Robust parsing: direct parse, then regex extraction, then textual "repair"
      let routeData = null;

      try {
        routeData = JSON.parse(content);
        return routeData;
      } catch (e) {
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          routeData = JSON.parse(jsonMatch[0]);
          return routeData;
        } catch (e) {
        }
      }

      try {
        const fixed = content
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        routeData = JSON.parse(fixed);
        return routeData;
      } catch (e) {
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  return null;
};

// Waypoints validation: count, value ranges, and ensuring it's not a straight line
const isWaypointsValid = (waypoints) => {
  if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 3) {
    return false;
  }

  const allValid = waypoints.every((wp, index) => {
    const isValid = (
      typeof wp.lat === 'number' &&
      typeof wp.lng === 'number' &&
      Math.abs(wp.lat) <= 90 &&
      Math.abs(wp.lng) <= 180 &&
      !(Math.abs(wp.lat) < 0.5 && Math.abs(wp.lng) < 0.5) // keep away from (0,0) and its vicinity
    );
    return isValid;
  });

  if (!allValid) {
    return false;
  }

  // Check it's not a straight line (by analyzing angles between segments)
  const isNotStraight = !isStraightLine(waypoints);
  if (!isNotStraight) {
  }

  return isNotStraight;
};

// Detect a "straight line" by the ratio of ~180° angles along the route
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

// Predefined hiking options for Queenstown (various safe, looped variants)
function getQueenstownHikingRoutes() {
  return [
    // Route 1 — Gardens + Esplanade + short Sunshine Bay
    [
      { lat: -45.0343, lng: 168.6576, name: "Start - Queenstown Gardens Entrance" },
      { lat: -45.0318, lng: 168.6621, name: "Marine Parade Boardwalk" },
      { lat: -45.0332, lng: 168.6518, name: "St Omer Park" },
      { lat: -45.0349, lng: 168.6395, name: "Sunshine Bay Track Access" },
      { lat: -45.0320, lng: 168.6395, name: "Fernhill Rd / Richards Park" },
      { lat: -45.0306, lng: 168.6627, name: "Ballarat St / Camp St" },
      { lat: -45.0343, lng: 168.6576, name: "Finish - Queenstown Gardens Entrance" }
    ],

    // Route 2 — Gardens + Skyline + Gorge Rd
    [
      { lat: -45.0343, lng: 168.6576, name: "Start - Queenstown Gardens Entrance" },
      { lat: -45.0329, lng: 168.6535, name: "Skyline Gondola Base" },
      { lat: -45.0291, lng: 168.6455, name: "Skyline Loop Trail Viewpoint" },
      { lat: -45.0248, lng: 168.6612, name: "Recreation Ground (Gorge Rd)" },
      { lat: -45.0306, lng: 168.6627, name: "Ballarat St / Camp St" },
      { lat: -45.0343, lng: 168.6576, name: "Finish - Queenstown Gardens Entrance" }
    ],

    // Route 3 — Gardens + Lake Esplanade + Fernhill Loop
    [
      { lat: -45.0343, lng: 168.6576, name: "Start - Queenstown Gardens Entrance" },
      { lat: -45.0339, lng: 168.6472, name: "Lake Esplanade / Brunswick St" },
      { lat: -45.0346, lng: 168.6440, name: "Lake Esplanade / Fernhill Rd" },
      { lat: -45.0370, lng: 168.6405, name: "Fernhill Scenic Lookout" },
      { lat: -45.0320, lng: 168.6395, name: "Fernhill Rd / Richards Park" },
      { lat: -45.0314, lng: 168.6628, name: "Beach St / Shotover St" },
      { lat: -45.0343, lng: 168.6576, name: "Finish - Queenstown Gardens Entrance" }
    ],
    [
      { lat: -45.03430, lng: 168.65760, name: "Start/Finish - Queenstown Gardens Entrance" },
      { lat: -45.03205, lng: 168.66190, name: "Marine Parade Boardwalk" },
      { lat: -45.03140, lng: 168.66275, name: "Beach St / Shotover St" },
      { lat: -45.03290, lng: 168.65920, name: "Marine Parade / Church St" },
      { lat: -45.03325, lng: 168.65180, name: "St Omer Park" },
      { lat: -45.03425, lng: 168.64650, name: "Lake Esplanade (Lakeview)" },
      { lat: -45.03485, lng: 168.64290, name: "Lake Esplanade / Fernhill Rd" },
      { lat: -45.03395, lng: 168.64760, name: "Brunswick St / Lake Esplanade" },
      { lat: -45.03270, lng: 168.65890, name: "Marine Parade (Gardens side)" },
      { lat: -45.03430, lng: 168.65760, name: "Finish - Queenstown Gardens Entrance" }
    ],

    // Route 2 — Skyline & Ben Lomond Lower Loop (~9–10 km, some climb)
    [
      { lat: -45.03430, lng: 168.65760, name: "Start/Finish - Queenstown Gardens Entrance" },
      { lat: -45.03325, lng: 168.66390, name: "Stanley St / Shotover St" },
      { lat: -45.03280, lng: 168.65360, name: "Skyline Gondola Base (Brecon St)" },
      { lat: -45.03020, lng: 168.64910, name: "Access to Skyline Rd" },
      { lat: -45.02860, lng: 168.64610, name: "Ben Lomond Track Lower Junction" },
      { lat: -45.02760, lng: 168.65190, name: "Descent toward Robins Rd" },
      { lat: -45.02480, lng: 168.66120, name: "Recreation Ground (Gorge Rd)" },
      { lat: -45.02990, lng: 168.66230, name: "Robins Rd / Ballarat St" },
      { lat: -45.03200, lng: 168.66140, name: "Marine Parade (lakefront)" },
      { lat: -45.03430, lng: 168.65760, name: "Finish - Queenstown Gardens Entrance" }
    ],

    // Route 3 — Sunshine Bay & Fernhill Loop (~11–12 km, varied)
    [
      { lat: -45.03430, lng: 168.65760, name: "Start/Finish - Queenstown Gardens Entrance" },
      { lat: -45.03325, lng: 168.65180, name: "St Omer Park" },
      { lat: -45.03425, lng: 168.64650, name: "Lake Esplanade (Lakeview)" },
      { lat: -45.03485, lng: 168.64290, name: "Lake Esplanade / Fernhill Rd" },
      { lat: -45.03490, lng: 168.63960, name: "Sunshine Bay Track Access" },
      { lat: -45.03670, lng: 168.63270, name: "Sunshine Bay Beach / Lookout" },
      { lat: -45.03600, lng: 168.63660, name: "Climb to Fernhill Rd (switchback)" },
      { lat: -45.03360, lng: 168.64220, name: "Fernhill Rd (eastbound)" },
      { lat: -45.03395, lng: 168.64720, name: "Back to Lake Esplanade" },
      { lat: -45.03180, lng: 168.66210, name: "Marine Parade Boardwalk" },
      { lat: -45.03430, lng: 168.65760, name: "Finish - Queenstown Gardens Entrance" }
    ]

  ];
}

let lastQueenstownIndex = null;

// Avoid returning the same preset route twice in a row
function getRandomQueenstownHikingWaypoints() {
  const routes = getQueenstownHikingRoutes();
  let idx;
  do {
    idx = Math.floor(Math.random() * routes.length);
  } while (routes.length > 1 && idx === lastQueenstownIndex);
  lastQueenstownIndex = idx;
  return routes[idx];
}

// Return preset waypoints for certain labels/trip types when applicable
function getPresetWaypointsIfAny(locationLabel, tripType) {
  if (!locationLabel || typeof locationLabel !== 'string') return null;
  const isQueenstown = /queenstown/i.test(locationLabel);
  if (tripType === 'hiking' && isQueenstown) {
    return { waypoints: getRandomQueenstownHikingWaypoints() };
  }
  return null;
}

module.exports = {
  planTrip
};