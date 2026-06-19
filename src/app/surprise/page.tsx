"use client";

import { useEffect, useCallback } from "react";
import { DecideView } from "@/components/DecideView";
import { StatusScreen } from "@/components/StatusScreen";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import type { LatLng } from "@/lib/decision/types";

export default function SurprisePage() {
  const { coords, error, request } = useGeolocation();
  useEffect(() => {
    request();
  }, [request]);

  const loader = useCallback((c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500), []);

  if (error) return <StatusScreen emoji="📍" text={error} />;
  if (!coords) return <StatusScreen emoji="📍" text="Requesting your location…" />;

  return <DecideView loadRestaurants={loader} autoStartCoords={coords} />;
}
