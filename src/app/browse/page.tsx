"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BrowseView } from "@/components/BrowseView";
import { StatusScreen } from "@/components/StatusScreen";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import { saveDraft } from "@/lib/vote/draft";
import { toSnapshot } from "@/lib/vote/snapshot";
import type { LatLng, Restaurant } from "@/lib/decision/types";

export default function BrowsePage() {
  const { coords, error, request } = useGeolocation();
  const router = useRouter();
  useEffect(() => {
    request();
  }, [request]);

  const loader = useCallback((c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500), []);

  const onVoteWithTeam = useCallback(
    (picks: Restaurant[]) => {
      saveDraft(picks.map((r) => ({ name: r.name, placeId: r.placeId, snapshot: toSnapshot(r) })));
      router.push("/vote?from=browse");
    },
    [router],
  );

  if (error) return <StatusScreen emoji="📍" text={error} />;
  if (!coords) return <StatusScreen emoji="📍" text="Requesting your location…" />;

  return <BrowseView loadRestaurants={loader} origin={coords} autoStartCoords={coords} onVoteWithTeam={onVoteWithTeam} />;
}
