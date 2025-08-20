import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// תיקון בעיית הצגת אייקוני ברירת מחדל ב-Leaflet בדפדפנים – טוען ישירות מ-CDN
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * צבעים ייחודיים לשני ימים בלבד (יום 1 – כחול, יום 2 – אדום)
 * בהתאם לדרישה שלא להציג יותר משני ימים במפה.
 */
const COLORS = ['#3B82F6', '#EF4444'];

const RouteMap = ({
  routeData,
  center = [40.7128, -74.0060],
  zoom = 10,
  height = '400px',
  showMarkers = true,
  showRoute = true
}) => {
  const containerRef = useRef(null); // רפרנס לאלמנט ה־DOM של המפה
  const mapRef = useRef(null);       // שמירת מופע המפה ל־Leaflet
  const overlayRef = useRef(null);   // שכבת שכבות (markers, polylines)

  // חילוץ קואורדינטות המרכז רק אם center הוא מערך תקין
  const centerLat = Array.isArray(center) ? center[0] : undefined;
  const centerLng = Array.isArray(center) ? center[1] : undefined;

  // אתחול המפה – קורה רק פעם אחת עם טעינת הקומפוננטה
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [0, 0], // התחלה ב־zoom מינימלי, נשנה אחר כך
      zoom: 1,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // טעינת אריחי המפה מ־OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    mapRef.current = map;

    // תיקון באג ידוע של Leaflet שמצריך invalidateSize אחרי רינדור
    setTimeout(() => map.invalidateSize(), 0);

    // האזנה לשינוי גודל הקונטיינר כדי להתאים את המפה אוטומטית
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    ro.observe(containerRef.current);

    // ניקוי משאבים בעת פירוק הקומפוננטה
    return () => {
      ro.disconnect();
      if (mapRef.current) {
        mapRef.current.eachLayer(l => mapRef.current.removeLayer(l));
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // שינוי גובה המפה בצורה דינמית לפי prop height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.style.height !== height) {
      el.style.height = height;
      if (mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 0);
    }
  }, [height]);

  // עדכון מרכז המפה ו־zoom כש-props משתנים
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      map.setView([centerLat, centerLng], zoom);
      setTimeout(() => map.invalidateSize(), 0);
    }
  }, [centerLat, centerLng, zoom]);

  // ציור מסלול ונקודות במפה
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // הסרת שכבה קודמת במידה וקיימת
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
    }
    overlayRef.current = L.layerGroup().addTo(map);

    // במידה ואין routeData, ניתן להציג רק Marker יחיד
    if (!routeData) {
      if (showMarkers && Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
        L.marker([centerLat, centerLng]).addTo(overlayRef.current).bindPopup('Location');
      }
      return;
    }

    // פונקציה להזחת נקודת סוף המסלול – כדי שהסמן לא יסתיר את קו המסלול
    const nudge = ([lat, lng], eastM = 6, northM = -6) => {
      const mPerDegLat = 111320;
      const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
      return [lat + northM / mPerDegLat, lng + eastM / mPerDegLng];
    };

    // ציור מסלולים יומיים – מוגבל ל־2 ימים
    if (showRoute && Array.isArray(routeData.dailyRoutes)) {
      let allBounds = null; // ישמש לקביעת תצוגת zoom אוטומטית

      routeData.dailyRoutes.slice(0, 2).forEach((dayRoute, idx) => {
        const dayPoints = (dayRoute.points && dayRoute.points.length)
          ? dayRoute.points
          : (routeData.points || []).filter(p => p.day === dayRoute.day);

        if (!dayPoints || dayPoints.length === 0) return;

        const latlngs = dayPoints.map(p => [p.lat, p.lng]);

        // יצירת קו המסלול בצבע שונה לכל יום
        const line = L.polyline(latlngs, {
          color: COLORS[idx],
          weight: 4,
          opacity: 0.9
        }).addTo(overlayRef.current);

        // סמן נקודת ההתחלה
        L.marker(latlngs[0], { zIndexOffset: 1000 })
          .addTo(overlayRef.current)
          .bindPopup(`Start Day ${dayRoute.day}`);

        // סמן נקודת הסיום – מוזחת מעט כדי לא לחפוף לקו
        if (latlngs.length > 1) {
          L.marker(nudge(latlngs[latlngs.length - 1]), { zIndexOffset: 900 })
            .addTo(overlayRef.current)
            .bindPopup(`End Day ${dayRoute.day}`);
        }

        // עדכון גבולות התצוגה כך שיכללו את כל המסלול
        const bounds = line.getBounds();
        allBounds = allBounds ? allBounds.extend(bounds) : bounds;
      });

      // התאמת המפה לכל המסלולים
      if (allBounds) map.fitBounds(allBounds, { padding: [20, 20] });
      return;
    }

    // מצב fallback – מציג רק מיקום אחד
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