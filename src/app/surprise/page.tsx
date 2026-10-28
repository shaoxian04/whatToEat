"use client";

import { useCallback } from "react";
import { DecideView } from "@/components/DecideView";
import { LocationGate } from "@/components/LocationGate";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import type { LatLng } from "@/lib/decision/types";

export default function SurprisePage() {
  const loader = useCallback((c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500), []);

  return (
    <LocationGate>
      {({ coords }) => (
        <DecideView key={`${coords.lat},${coords.lng}`} loadRestaurants={loader} autoStartCoords={coords} />
      )}
    </LocationGate>
  );
}
