"use client";

import { useEffect } from "react";
import { BrowseView } from "@/components/BrowseView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import type { LatLng } from "@/lib/decision/types";

export default function BrowsePage() {
  const { coords, error, request } = useGeolocation();
  useEffect(() => { request(); }, [request]);

  const loader = (c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500);

  if (error) return <p className="p-6">{error}</p>;
  if (!coords) return <p className="p-6">Requesting your location…</p>;

  return <BrowseView loadRestaurants={loader} origin={coords} autoStartCoords={coords} />;
}
