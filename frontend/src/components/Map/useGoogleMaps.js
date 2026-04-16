import { useEffect, useState } from 'react';

let loadPromise = null;

export default function useGoogleMaps() {
  const [loaded, setLoaded] = useState(!!window.google?.maps);

  useEffect(() => {
    if (window.google?.maps) {
      setLoaded(true);
      return;
    }

    if (!loadPromise) {
      loadPromise = new Promise((resolve) => {
        const existing = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          return;
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry`;
        script.async = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }

    loadPromise.then(() => setLoaded(true));
  }, []);

  return loaded;
}
