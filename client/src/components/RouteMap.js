import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];

const RouteMap = ({
  routeData,
  center = [40.7128, -74.0060],
  zoom = 10,
  height = '400px',
  showMarkers = true,
  showRoute = true
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);

  // ערכים פשוטים עבור תלויות
  const centerLat = Array.isArray(center) ? center[0] : undefined;
  const centerLng = Array.isArray(center) ? center[1] : undefined;

  // 1) אתחול מפה פעם אחת בלבד — בלי שימוש ב־props
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const container = containerRef.current;
    const map = L.map(container, {
      center: [0, 0], // יסתנכרן מיד אח"כ ב־effect נפרד
      zoom: 1,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    mapRef.current = map;

    // invalidateSize אחרי שה-DOM מתייצב
    setTimeout(() => map.invalidateSize(), 0);

    // עדכון גודל אוטומטי כשקונטיינר משתנה
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (!mapRef.current) return;
      mapRef.current.eachLayer(l => mapRef.current.removeLayer(l));
      mapRef.current.remove();
      mapRef.current = null;
    };
  }, []); // ⬅️ נקי מתלויות — אין שימוש ב־props כאן

  // 1.א) סנכרון גובה הקונטיינר עם prop height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // אם אין גובה — קובע, ואם יש שינוי — מעדכן
    if (el.style.height !== height) {
      el.style.height = height;
      // על שינוי גובה כדאי לרענן מפה
      if (mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 0);
    }
  }, [height]);

  // 2) שינוי center/zoom בלי להרוס מפה (תלויות פשוטות)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      map.setView([centerLat, centerLng], zoom);
      setTimeout(() => map.invalidateSize(), 0);
    }
  }, [centerLat, centerLng, zoom]);

  // 3) ציור/עדכון שכבות בלבד
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // נקה שכבה קודמת שלנו
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }
    overlayRef.current = L.layerGroup().addTo(map);

    // אין נתיב? רק סמן במרכז
    if (!routeData) {
      if (showMarkers && Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
        L.marker([centerLat, centerLng]).addTo(overlayRef.current).bindPopup('Location');
      }
      return;
    }

    // עזר להסטה קלה של סמן End אם צריך
    const nudge = ([lat, lng], eastM = 6, northM = -6) => {
      const mPerDegLat = 111320;
      const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
      return [lat + northM / mPerDegLat, lng + eastM / mPerDegLng];
    };

    // dailyRoutes קודם
    if (showRoute && Array.isArray(routeData.dailyRoutes) && routeData.dailyRoutes.length > 0) {
      let allBounds = null;

      routeData.dailyRoutes.forEach((dayRoute, idx) => {
        const dayPoints = (dayRoute.points && dayRoute.points.length)
          ? dayRoute.points
          : (routeData.points || []).filter(p => p.day === dayRoute.day);

        if (!dayPoints || dayPoints.length === 0) return;

        const latlngs = dayPoints.map(p => [p.lat, p.lng]);
        const line = L.polyline(latlngs, {
          color: COLORS[idx % COLORS.length],
          weight: 4,
          opacity: 0.9
        }).addTo(overlayRef.current);

        const startLabel = `Start ${dayRoute.day ?? (idx + 1)}`;
        const endLabel   = `End ${dayRoute.day ?? (idx + 1)}`;

        const startMarker = L.marker(latlngs[0], { zIndexOffset: 1000 })
          .addTo(overlayRef.current)
          .bindPopup(startLabel);

        if ((dayRoute.day ?? (idx + 1)) === 1) startMarker.openPopup();

        if (latlngs.length > 1) {
          L.marker(nudge(latlngs[latlngs.length - 1]), { zIndexOffset: 900 })
            .addTo(overlayRef.current)
            .bindPopup(endLabel);
        }

        const b = line.getBounds();
        allBounds = allBounds ? allBounds.extend(b) : b;
      });

      if (allBounds) map.fitBounds(allBounds, { padding: [20, 20] });
      return;
    }

    // geometry כקו יחיד
    if (showRoute && routeData.geometry) {
      const geoLayer = L.geoJSON(routeData.geometry, { style: { weight: 4, opacity: 0.9 } })
        .addTo(overlayRef.current);

      if (
        showMarkers &&
        routeData.geometry.type === 'LineString' &&
        Array.isArray(routeData.geometry.coordinates) &&
        routeData.geometry.coordinates.length
      ) {
        const c = routeData.geometry.coordinates;
        L.marker([c[0][1], c[0][0]]).addTo(overlayRef.current).bindPopup('Start');
        if (c.length > 1) {
          L.marker([c[c.length - 1][1], c[c.length - 1][0]])
            .addTo(overlayRef.current)
            .bindPopup('End');
        }
      }

      map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
      return;
    }

    // fallback: לפי points
    if (showRoute && Array.isArray(routeData.points) && routeData.points.length > 0) {
      const byDay = {};
      routeData.points.forEach(p => {
        (byDay[p.day] ||= []).push([p.lat, p.lng]);
      });

      let allBounds = null;

      Object.keys(byDay).forEach((day, i) => {
        const line = L.polyline(byDay[day], {
          color: COLORS[i % COLORS.length], weight: 4, opacity: 0.9
        }).addTo(overlayRef.current);

        L.marker(byDay[day][0]).addTo(overlayRef.current).bindPopup(`Start ${i + 1}`);
        if (byDay[day].length > 1) {
          L.marker(byDay[day][byDay[day].length - 1]).addTo(overlayRef.current).bindPopup(`End ${i + 1}`);
        }

        const b = line.getBounds();
        allBounds = allBounds ? allBounds.extend(b) : b;
      });

      if (allBounds) map.fitBounds(allBounds, { padding: [20, 20] });
      return;
    }

    // אם אין מה לצייר – רק סמן במרכז
    if (showMarkers && Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      L.marker([centerLat, centerLng]).addTo(overlayRef.current).bindPopup('Location');
    }
  }, [routeData, showMarkers, showRoute, centerLat, centerLng]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', minHeight: '500px' }}
      className="rounded-lg overflow-hidden"
    />
  );
};

export default RouteMap;
