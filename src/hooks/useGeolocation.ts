"use client";

import { useState, useCallback } from "react";
import type { LatLng } from "@/lib/decision/types";

export function useGeolocation() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Location is not supported on this device.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      () => {
        setError("We couldn't get your location. Please allow location access.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }, []);

  return { coords, error, loading, request };
}
