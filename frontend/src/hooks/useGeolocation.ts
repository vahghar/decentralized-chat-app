import { useState, useEffect } from 'react';

interface GeolocationState {
  lat: number | null;
  lon: number | null;
  error: string | null;
  loading: boolean;
}

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lon: null,
    error: null,
    loading: false,
  });

  const requestLocation = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, loading: false, error: 'Geolocation is not supported by your browser' }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (error) => {
        setState({
          lat: null,
          lon: null,
          error: error.message,
          loading: false,
        });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  return { ...state, requestLocation };
};
