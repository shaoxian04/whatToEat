"use client";

import { useEffect } from "react";
import { DecideView } from "@/components/DecideView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import type { LatLng } from "@/lib/decision/types";

export default function SurprisePage() {
  const { coords, error, request } = useGeolocation();
  useEffect(() => { request(); }, [request]);

  const loader = (c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500);

  if (error) return <p className="p-6">{error}</p>;
  if (!coords) return <p className="p-6">Requesting your location…</p>;

  return <DecideView loadRestaurants={loader} autoStartCoords={coords} />;
}
