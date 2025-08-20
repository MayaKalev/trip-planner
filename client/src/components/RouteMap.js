import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet marker icons in some browsers — load directly from a CDN
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Unique colors for exactly two days only (Day 1 – blue, Day 2 – red),
 * per the requirement to show no more than two days on the map.
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
  const containerRef = useRef(null); // Reference to the map's DOM container
  const mapRef = useRef(null);       // Holds the Leaflet map instance
  const overlayRef = useRef(null);   // Layer group for overlays (markers, polylines)

  const centerLat = Array.isArray(center) ? center[0] : undefined;
  const centerLng = Array.isArray(center) ? center[1] : undefined;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [0, 0],
      zoom: 1,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Load map tiles from OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    mapRef.current = map;

    // Workaround for a known Leaflet quirk: call invalidateSize after render
    setTimeout(() => map.invalidateSize(), 0);

    // Observe container size changes and auto-adjust the map
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    ro.observe(containerRef.current);

    // Cleanup on unmount
    return () => {
      ro.disconnect();
      if (mapRef.current) {
        mapRef.current.eachLayer(l => mapRef.current.removeLayer(l));
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Dynamically update the map height based on the `height` prop
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.style.height !== height) {
      el.style.height = height;
      if (mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 0);
    }
  }, [height]);

  // Update map center and zoom when props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      map.setView([centerLat, centerLng], zoom);
      setTimeout(() => map.invalidateSize(), 0);
    }
  }, [centerLat, centerLng, zoom]);

  // Draw route and points on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous overlay layer if it exists
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
    }
    overlayRef.current = L.layerGroup().addTo(map);

    // If no routeData is provided, optionally show a single marker
    if (!routeData) {
      if (showMarkers && Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
        L.marker([centerLat, centerLng]).addTo(overlayRef.current).bindPopup('Location');
      }
      return;
    }

    // Slightly nudge the end marker so it doesn't overlap the polyline
    const nudge = ([lat, lng], eastM = 6, northM = -6) => {
      const mPerDegLat = 111320;
      const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
      return [lat + northM / mPerDegLat, lng + eastM / mPerDegLng];
    };

    // Render daily routes — limited to 2 days
    if (showRoute && Array.isArray(routeData.dailyRoutes)) {
      let allBounds = null; // Used to compute an automatic zoom to fit all routes

      routeData.dailyRoutes.slice(0, 2).forEach((dayRoute, idx) => {
        const dayPoints = (dayRoute.points && dayRoute.points.length)
          ? dayRoute.points
          : (routeData.points || []).filter(p => p.day === dayRoute.day);

        if (!dayPoints || dayPoints.length === 0) return;

        const latlngs = dayPoints.map(p => [p.lat, p.lng]);

        // Create the polyline for this day's route with a distinct color
        const line = L.polyline(latlngs, {
          color: COLORS[idx],
          weight: 4,
          opacity: 0.9
        }).addTo(overlayRef.current);

        // Start marker
        L.marker(latlngs[0], { zIndexOffset: 1000 })
          .addTo(overlayRef.current)
          .bindPopup(`Start Day ${dayRoute.day}`);

        // End marker — slightly offset so it doesn't overlap the line
        if (latlngs.length > 1) {
          L.marker(nudge(latlngs[latlngs.length - 1]), { zIndexOffset: 900 })
            .addTo(overlayRef.current)
            .bindPopup(`End Day ${dayRoute.day}`);
        }

        // Extend the overall bounds to include this route
        const bounds = line.getBounds();
        allBounds = allBounds ? allBounds.extend(bounds) : bounds;
      });

      // Fit the map view to include all routes
      if (allBounds) map.fitBounds(allBounds, { padding: [20, 20] });
      return;
    }

    // Fallback mode — show a single location marker
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