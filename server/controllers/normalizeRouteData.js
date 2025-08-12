// server/services/normalizeRouteData.js

function asNumber(n) {
    const v = Number(n);
    return Number.isFinite(v) ? v : null;
  }
  
  function buildDailyRoutesFromPoints(points = []) {
    const byDay = {};
    for (const p of points) {
      const lat = asNumber(p.lat);
      const lng = asNumber(p.lng);
      if (lat == null || lng == null) continue;
      const day = p.day != null ? Number(p.day) : 1;
      (byDay[day] ||= []).push({ lat, lng });
    }
    return Object.keys(byDay)
      .sort((a, b) => Number(a) - Number(b))
      .map(d => ({ day: Number(d), points: byDay[d] }));
  }
  
  function lineFromDailyRoutes(dailyRoutes = []) {
    const coords = [];
    for (const d of dailyRoutes) {
      if (!Array.isArray(d.points)) continue;
      for (const p of d.points) {
        const lat = asNumber(p.lat);
        const lng = asNumber(p.lng);
        if (lat == null || lng == null) continue;
        coords.push([lng, lat]); // GeoJSON: [lng, lat]
      }
    }
    return coords.length >= 2 ? { type: 'LineString', coordinates: coords } : null;
  }
  
  function normalizeGeometry(geometry) {
    if (!geometry) return null;
  
    // Support: LineString, Feature, FeatureCollection
    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      return geometry;
    }
  
    if (geometry.type === 'Feature' && geometry.geometry) {
      const g = geometry.geometry;
      if (g.type === 'LineString' && Array.isArray(g.coordinates)) return g;
    }
  
    if (geometry.type === 'FeatureCollection' && Array.isArray(geometry.features)) {
      const f = geometry.features.find(f => f?.geometry?.type === 'LineString');
      if (f?.geometry?.coordinates) return { type: 'LineString', coordinates: f.geometry.coordinates };
    }
  
    return null;
  }
  
  function average(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  }
  
  module.exports = function normalizeRouteData(input = {}, location) {
    const out = JSON.parse(JSON.stringify(input || {}));
  
    // 1) ensure dailyRoutes
    if (!Array.isArray(out.dailyRoutes) || !out.dailyRoutes.length) {
      if (Array.isArray(out.points) && out.points.length) {
        out.dailyRoutes = buildDailyRoutesFromPoints(out.points);
      } else {
        out.dailyRoutes = Array.isArray(out.dailyRoutes) ? out.dailyRoutes : [];
      }
    } else {
      // sanitize points
      out.dailyRoutes = out.dailyRoutes.map(d => ({
        day: d.day != null ? Number(d.day) : 1,
        points: (d.points || [])
          .map(p => ({ lat: asNumber(p.lat), lng: asNumber(p.lng) }))
          .filter(p => p.lat != null && p.lng != null)
      })).filter(d => d.points.length);
    }
  
    // 2) ensure geometry as GeoJSON LineString
    let geom = normalizeGeometry(out.geometry);
    if (!geom || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
      geom = lineFromDailyRoutes(out.dailyRoutes);
    }
    out.geometry = geom || null;
  
    // 3) compute center for map (not mandatory to store)
    let center = out.center;
    if (!center) {
      if (out.geometry?.coordinates?.length) {
        const lats = out.geometry.coordinates.map(c => Number(c[1])).filter(Number.isFinite);
        const lngs = out.geometry.coordinates.map(c => Number(c[0])).filter(Number.isFinite);
        if (lats.length && lngs.length) center = [average(lats), average(lngs)];
      } else if (location?.coordinates) {
        const lat = asNumber(location.coordinates.lat);
        const lng = asNumber(location.coordinates.lng);
        if (lat != null && lng != null) center = [lat, lng];
      }
    }
  
    return { routeData: out, center };
  };
  