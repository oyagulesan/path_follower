import { useRef, useEffect } from 'react';

export default function TaskMiniMap({ area }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !area || !window.google?.maps) return;

    const map = new window.google.maps.Map(ref.current, {
      disableDefaultUI: true,
      gestureHandling: 'none',
      zoomControl: false,
    });

    const polygon = new window.google.maps.Polygon({
      paths: area,
      fillColor: '#4A90D9',
      fillOpacity: 0.3,
      strokeWeight: 2,
      strokeColor: '#4A90D9',
    });
    polygon.setMap(map);

    const bounds = new window.google.maps.LatLngBounds();
    area.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds);
  }, [area]);

  return <div ref={ref} className="map-mini" />;
}
