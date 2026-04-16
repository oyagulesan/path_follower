import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import toast from 'react-hot-toast';

// Distinct colors for different users' paths
const PATH_COLORS = ['#FF4136', '#0074D9', '#2ECC40', '#FF851B', '#B10DC9', '#FFDC00', '#01FF70', '#F012BE'];

function createInitialsMarkerIcon(initials, bgColor = '#FF4136') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <path d="M20 48 C20 48 0 28 0 18 A20 20 0 0 1 40 18 C40 28 20 48 20 48Z" fill="${bgColor}" stroke="#fff" stroke-width="2"/>
      <circle cx="20" cy="18" r="13" fill="#fff"/>
      <text x="20" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="${bgColor}">${initials}</text>
    </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(40, 48),
    anchor: new window.google.maps.Point(20, 48),
  };
}

function getInitials(name, lastName) {
  return ((name?.[0] || '') + (lastName?.[0] || '')).toUpperCase() || '?';
}

export default function TaskTracking() {
  const { id: taskId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const [task, setTask] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [insideArea, setInsideArea] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const [activeUsers, setActiveUsers] = useState({});
  const [mapReady, setMapReady] = useState(false);
  const { t } = useI18n();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonRef = useRef(null);
  const userMarkerRef = useRef(null);
  const activeMarkerRefs = useRef({});
  const pathPolylinesRef = useRef([]);
  const livePolylineRef = useRef(null);
  const livePathRef = useRef([]);
  const watchIdRef = useRef(null);
  const sendIntervalRef = useRef(null);
  const lastSentRef = useRef(null);
  const activeSessionIdRef = useRef(null);

  // Fetch task data
  useEffect(() => {
    api.get(`/tasks/${taskId}`).then(({ data }) => setTask(data));
  }, [taskId]);

  // Check for existing active session on load
  useEffect(() => {
    api.get(`/tasks/${taskId}/active-session`).then(({ data }) => {
      if (data) {
        activeSessionIdRef.current = data.id;
        setTracking(true);
        // Store existing points so live polyline can show them
        if (data.points && data.points.length > 0) {
          livePathRef.current = data.points.map((p) => ({ lat: p.lat, lng: p.lng }));
        }
      }
    });
  }, [taskId]);

  // Initialize map
  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!window.google?.maps) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 41.0082, lng: 28.9784 },
      zoom: 14,
    });
    mapInstanceRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!task) return; // map div not in DOM until task loads

    if (window.google?.maps) {
      initMap();
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      if (existing.dataset.loaded) {
        initMap();
      } else {
        existing.addEventListener('load', initMap);
      }
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry`;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      initMap();
    };
    document.head.appendChild(script);
  }, [initMap, task]);

  // Draw task area polygon and recorded paths when task loads AND map is ready
  useEffect(() => {
    if (!task || !mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Draw area polygon
    if (polygonRef.current) polygonRef.current.setMap(null);
    const polygon = new window.google.maps.Polygon({
      paths: task.area,
      fillColor: '#4A90D9',
      fillOpacity: 0.2,
      strokeWeight: 2,
      strokeColor: '#4A90D9',
    });
    polygon.setMap(map);
    polygonRef.current = polygon;

    // Fit bounds to area
    const bounds = new window.google.maps.LatLngBounds();
    task.area.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds);

    // Draw recorded paths
    pathPolylinesRef.current.forEach((p) => p.setMap(null));
    pathPolylinesRef.current = [];

    if (task.trackingSessions) {
      const userColorMap = {};
      let colorIdx = 0;

      task.trackingSessions.forEach((session) => {
        if (session.points.length < 2) return;
        if (!userColorMap[session.userId]) {
          userColorMap[session.userId] = PATH_COLORS[colorIdx % PATH_COLORS.length];
          colorIdx++;
        }
        const polyline = new window.google.maps.Polyline({
          path: session.points.map((p) => ({ lat: p.lat, lng: p.lng })),
          strokeColor: userColorMap[session.userId],
          strokeOpacity: 0.8,
          strokeWeight: 4,
        });
        polyline.setMap(map);
        pathPolylinesRef.current.push(polyline);
      });
    }
  }, [task, mapReady]);

  // Watch user's current position — starts immediately, independent of map
  useEffect(() => {
    if (!navigator.geolocation) {
      toast.error(t('tracking.geolocationNotSupported'));
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.error('Geolocation error:', err);
        toast.error(t('tracking.locationError'));
      },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
    );

    watchIdRef.current = watcher;
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  // Place/update user marker and check inside-area when position or map changes
  useEffect(() => {
    if (!currentPos || !mapReady || !mapInstanceRef.current) return;

    const myInitials = getInitials(user.name, user.lastName);
    if (!userMarkerRef.current) {
      userMarkerRef.current = new window.google.maps.Marker({
        position: currentPos,
        map: mapInstanceRef.current,
        icon: createInitialsMarkerIcon(myInitials, '#4285F4'),
        title: `${user.name} ${user.lastName}`,
        zIndex: 999,
      });
    } else {
      userMarkerRef.current.setPosition(currentPos);
    }

    // Check if inside area
    if (polygonRef.current && window.google?.maps?.geometry) {
      const inside = window.google.maps.geometry.poly.containsLocation(
        new window.google.maps.LatLng(currentPos.lat, currentPos.lng),
        polygonRef.current
      );
      setInsideArea(inside);
    }
  }, [currentPos, mapReady]);

  // Handle pause/resume based on area boundary
  useEffect(() => {
    if (!tracking) return;

    if (!insideArea && !paused) {
      setPaused(true);
      toast(t('tracking.pausedLeft'), { icon: '⏸️' });
    } else if (insideArea && paused) {
      setPaused(false);
      toast(t('tracking.resumedBack'), { icon: '▶️' });
    }
  }, [insideArea, tracking, paused]);

  // Resume tracking on socket: if we detected an active session, tell the server
  useEffect(() => {
    if (!socket || !tracking || !activeSessionIdRef.current) return;

    socket.emit('tracking:resume', {
      sessionId: activeSessionIdRef.current,
      taskId,
    });

    socket.on('tracking:resumed', () => {
      // Start sending location updates
      startLocationInterval();
    });

    return () => {
      socket.off('tracking:resumed');
    };
  }, [socket, tracking]);

  // Draw live polyline from existing session points when map is ready and we're tracking
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !tracking) return;
    if (livePathRef.current.length === 0) return;
    if (livePolylineRef.current) return; // already drawn

    livePolylineRef.current = new window.google.maps.Polyline({
      path: livePathRef.current,
      strokeColor: '#2ECC40',
      strokeOpacity: 1,
      strokeWeight: 4,
    });
    livePolylineRef.current.setMap(mapInstanceRef.current);
  }, [mapReady, tracking]);

  // Socket: join task room and listen for live updates
  useEffect(() => {
    if (!socket || !taskId) return;

    socket.emit('task:join', taskId);

    socket.on('tracking:location-update', (data) => {
      if (data.userId === user.id) return; // skip own updates

      setActiveUsers((prev) => ({
        ...prev,
        [data.userId]: { ...data },
      }));

      // Update marker on map
      if (mapInstanceRef.current) {
        const initials = getInitials(data.name, data.lastName);
        const fullName = `${data.name} ${data.lastName}`;
        if (!activeMarkerRefs.current[data.userId]) {
          activeMarkerRefs.current[data.userId] = new window.google.maps.Marker({
            position: { lat: data.lat, lng: data.lng },
            map: mapInstanceRef.current,
            icon: createInitialsMarkerIcon(initials, '#FF4136'),
            title: fullName,
          });
        } else {
          activeMarkerRefs.current[data.userId].setPosition({ lat: data.lat, lng: data.lng });
        }
      }
    });

    socket.on('tracking:user-ended', (data) => {
      setActiveUsers((prev) => {
        const copy = { ...prev };
        delete copy[data.userId];
        return copy;
      });
      if (activeMarkerRefs.current[data.userId]) {
        activeMarkerRefs.current[data.userId].setMap(null);
        delete activeMarkerRefs.current[data.userId];
      }
    });

    return () => {
      socket.emit('task:leave', taskId);
      socket.off('tracking:location-update');
      socket.off('tracking:user-ended');
    };
  }, [socket, taskId, user.id]);

  const startLocationInterval = () => {
    if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);

    sendIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };

          // Check if inside area for pause/resume
          let inside = true;
          if (polygonRef.current && window.google?.maps?.geometry) {
            inside = window.google.maps.geometry.poly.containsLocation(
              new window.google.maps.LatLng(loc.lat, loc.lng),
              polygonRef.current
            );
            setInsideArea(inside);
          }

          // Always send location so other users can see the marker
          if (socket) {
            socket.emit('tracking:location', { ...loc, insideArea: inside });
          }
          lastSentRef.current = loc;

          // Only record path when inside the area
          if (inside) {
            livePathRef.current.push(loc);
            if (livePolylineRef.current) {
              livePolylineRef.current.setPath(livePathRef.current);
            }
          }
        },
        null,
        { enableHighAccuracy: false, timeout: 15000 }
      );
    }, 10000);
  };

  const handleStart = () => {
    if (!socket || !currentPos) return;

    socket.emit('tracking:start', { taskId });
    setTracking(true);
    setPaused(false);
    livePathRef.current = [currentPos];
    activeSessionIdRef.current = null; // will be set by tracking:started

    // Create live polyline
    if (mapInstanceRef.current) {
      if (livePolylineRef.current) livePolylineRef.current.setMap(null);
      livePolylineRef.current = new window.google.maps.Polyline({
        path: [currentPos],
        strokeColor: '#2ECC40',
        strokeOpacity: 1,
        strokeWeight: 4,
      });
      livePolylineRef.current.setMap(mapInstanceRef.current);
    }

    // Listen for session ID from server
    socket.once('tracking:started', ({ sessionId }) => {
      activeSessionIdRef.current = sessionId;
    });

    startLocationInterval();

    // Send initial location
    socket.emit('tracking:location', { ...currentPos, insideArea: true });
    toast.success(t('tracking.started'));
  };

  const handleEnd = () => {
    if (!socket) return;

    socket.emit('tracking:end');
    setTracking(false);
    setPaused(false);
    activeSessionIdRef.current = null;

    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }

    if (livePolylineRef.current) {
      livePolylineRef.current.setMap(null);
      livePolylineRef.current = null;
    }
    livePathRef.current = [];

    toast.success(t('tracking.ended'));

    // Refresh task to show new path
    api.get(`/tasks/${taskId}`).then(({ data }) => setTask(data));
  };

  if (!task) return <div className="page"><p>{t('common.loading')}</p></div>;

  return (
    <div className="page">
      <h2>{task.title}</h2>
      <p className="task-dates">
        {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}
      </p>

      <div ref={mapRef} className="map-container map-large" />

      <div className="tracking-controls">
        {!tracking && (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={!insideArea || !currentPos}
          >
            {!currentPos ? t('tracking.gettingLocation') : !insideArea ? t('tracking.moveInsideArea') : t('tracking.startTracking')}
          </button>
        )}

        {tracking && (
          <>
            {paused && <div className="tracking-status paused">{t('tracking.paused')}</div>}
            {!paused && <div className="tracking-status active">{t('tracking.active')}</div>}
            <button className="btn btn-danger btn-lg" onClick={handleEnd}>
              {t('tracking.endTracking')}
            </button>
          </>
        )}
      </div>

      {Object.keys(activeUsers).length > 0 && (
        <div className="active-users">
          <h4>{t('tracking.activeUsers')}</h4>
          {Object.values(activeUsers).map((u) => (
            <span key={u.userId} className="active-user-badge">{u.name} {u.lastName}</span>
          ))}
        </div>
      )}
    </div>
  );
}
