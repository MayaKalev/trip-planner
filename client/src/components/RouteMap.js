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

const RouteMap = ({ 
  routeData, 
  center = [40.7128, -74.0060], 
  zoom = 10, 
  height = '400px',
  showMarkers = true,
  showRoute = true 
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Ensure the container has proper dimensions
    const container = mapRef.current;
    if (container.offsetHeight === 0) {
      container.style.height = height;
    }

    // Initialize map with error handling
    try {
      const map = L.map(container, {
        center: center,
        zoom: zoom,
        zoomControl: true,
        scrollWheelZoom: true
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(map);

      mapInstanceRef.current = map;

      // Force a resize after initialization
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [center, zoom, height]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
  
    const map = mapInstanceRef.current;
  
    try {
      // ננקה רק שכבות ציור קודמות שלנו (geojson/polylines/markers) – נשמור אותן בקבוצה אחת
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
      overlayRef.current = L.layerGroup().addTo(map);
  
      // אם אין Route – נשאיר סמן במרכז (כמו שהיה)
      if (!routeData) {
        if (showMarkers) {
          L.marker(center).addTo(overlayRef.current)
            .bindPopup('Location')
            .openPopup();
        }
        return;
      }
  
    // Draw route if routeData is provided
    if (showRoute && routeData) {
      // --- עדיפות: אם יש dailyRoutes – מציירים כל יום בנפרד ---
      if (Array.isArray(routeData.dailyRoutes) && routeData.dailyRoutes.length > 0) {
        const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];
        let allBounds = null;

        routeData.dailyRoutes.forEach((dayRoute, idx) => {
          // מקור הנקודות: או dayRoute.points או פילטר לפי day מ-routeData.points
          const dayPoints = (dayRoute.points && dayRoute.points.length)
            ? dayRoute.points
            : (routeData.points || []).filter(p => p.day === dayRoute.day);

          if (!dayPoints || dayPoints.length === 0) return;

          const latlngs = dayPoints.map(p => [p.lat, p.lng]);

          // קו למסלול היומי
          const line = L.polyline(latlngs, {
            color: colors[idx % colors.length],
            weight: 4,
            opacity: 0.9
          }).addTo(overlayRef.current);

          // סימון התחלה/סיום לכל יום – לפי הבקשה "Start 1/2"
          // תיוג לפי היום האמיתי, ופתיחת popup ל-Start של יום 1
          const startLabel = `Start ${dayRoute.day ?? (idx + 1)}`;
          const endLabel   = `End ${dayRoute.day ?? (idx + 1)}`;

          const startMarker = L.marker(latlngs[0], { zIndexOffset: 1000 })
            .addTo(overlayRef.current)
            .bindPopup(startLabel);

          // פותחים את ה-popup של יום 1 כדי לוודא שרואים אותו
          if ((dayRoute.day ?? (idx + 1)) === 1) {
            startMarker.openPopup();
          }

          // אם יש חפיפה עם סוף יום אחר, נזיז טיפה את ה-End כדי שלא יכסה
          function nudge([lat, lng], eastM = 6, northM = -6) {
            const mPerDegLat = 111320;
            const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
            return [lat + northM / mPerDegLat, lng + eastM / mPerDegLng];
          }

          if (latlngs.length > 1) {
            const endPos = nudge(latlngs[latlngs.length - 1], 6, -6); // הזזה קלה
            L.marker(endPos, { zIndexOffset: 900 })
              .addTo(overlayRef.current)
              .bindPopup(endLabel);
          }

          // איסוף גבולות לכל הימים
          const b = line.getBounds();
          allBounds = allBounds ? allBounds.extend(b) : b;
        });

        if (allBounds) {
          map.fitBounds(allBounds, { padding: [20, 20] });
        }
        return; // סיימנו ציור לפי ימים
      }

      // --- אם אין dailyRoutes אבל יש geometry – מציירים GeoJSON (קו יחיד) ---
      if (routeData.geometry) {
        const geoLayer = L.geoJSON(routeData.geometry, {
          style: { weight: 4, opacity: 0.9 }
        }).addTo(overlayRef.current);

        if (showMarkers && routeData.geometry.type === 'LineString' &&
            Array.isArray(routeData.geometry.coordinates)) {
          const c = routeData.geometry.coordinates;
          if (c.length) {
            L.marker([c[0][1], c[0][0]]).addTo(overlayRef.current).bindPopup('Start');
            if (c.length > 1) {
              L.marker([c[c.length - 1][1], c[c.length - 1][0]]).addTo(overlayRef.current).bindPopup('End');
            }
          }
        }
        map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
        return;
      }

      // --- fallback: ציור לפי points מקובצים לפי day ---
      if (routeData.points && routeData.points.length > 0) {
        const byDay = {};
        routeData.points.forEach(p => {
          (byDay[p.day] ||= []).push([p.lat, p.lng]);
        });

        const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];
        let allBounds = null;

        Object.keys(byDay).forEach((day, i) => {
          const line = L.polyline(byDay[day], {
            color: colors[i % colors.length], weight: 4, opacity: 0.9
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
    }

  
  
      // אם אין routeData.points או showRoute=false – רק סמן במרכז
      if (showMarkers) {
        L.marker(center).addTo(overlayRef.current).bindPopup('Location').openPopup();
      }
    } catch (error) {
      console.error('Error updating map:', error);
    }
  }, [routeData, showMarkers, showRoute, center]);
  

  return (
    <div 
      ref={mapRef} 
      style={{ height, width: '100%', minHeight: '200px' }}
      className="rounded-lg overflow-hidden"
    />
  );
};

export default RouteMap; 