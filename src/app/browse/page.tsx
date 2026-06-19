"use client";

import { useEffect, useCallback } from "react";
import { BrowseView } from "@/components/BrowseView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import type { LatLng } from "@/lib/decision/types";

function StatusScreen({ emoji, text }: { emoji: string; text: string }) {
  return (
    <main className="placemat flex min-h-screen flex-col items-center justify-center gap-2 px-5 text-center">
      <p className="text-5xl">{emoji}</p>
      <p className="font-display text-xl font-bold">{text}</p>
    </main>
  );
}

export default function BrowsePage() {
  const { coords, error, request } = useGeolocation();
  useEffect(() => {
    request();
  }, [request]);

  const loader = useCallback((c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500), []);

  if (error) return <StatusScreen emoji="📍" text={error} />;
  if (!coords) return <StatusScreen emoji="📍" text="Requesting your location…" />;

  return <BrowseView loadRestaurants={loader} origin={coords} autoStartCoords={coords} />;
}
