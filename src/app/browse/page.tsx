"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { BrowseView } from "@/components/BrowseView";
import { LocationGate } from "@/components/LocationGate";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import { saveDraft } from "@/lib/vote/draft";
import { toSnapshot } from "@/lib/vote/snapshot";
import type { LatLng, Restaurant } from "@/lib/decision/types";

export default function BrowsePage() {
  const router = useRouter();

  const loader = useCallback(
    (c: LatLng, radiusMeters: number) => fetchNearbyRestaurants(c.lat, c.lng, radiusMeters),
    [],
  );

  const onVoteWithTeam = useCallback(
    (picks: Restaurant[]) => {
      saveDraft(picks.map((r) => ({ name: r.name, placeId: r.placeId, snapshot: toSnapshot(r) })));
      router.push("/vote?from=browse");
    },
    [router],
  );

  return (
    <LocationGate>
      {({ coords, label, changeArea }) => (
        <BrowseView
          key={`${coords.lat},${coords.lng}`}
          loadRestaurants={loader}
          origin={coords}
          autoStartCoords={coords}
          onVoteWithTeam={onVoteWithTeam}
          areaLabel={label}
          onChangeArea={changeArea}
        />
      )}
    </LocationGate>
  );
}
