"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { applyFilters, type FilterCriteria } from "@/lib/decision/filter";
import { RestaurantCard } from "@/components/RestaurantCard";
import { FilterControls } from "@/components/FilterControls";

interface Props {
  loadRestaurants: (coords: LatLng) => Promise<Restaurant[]>;
  origin: LatLng;
  autoStartCoords?: LatLng;
}

export function BrowseView({ loadRestaurants, origin, autoStartCoords }: Props) {
  const [pool, setPool] = useState<Restaurant[]>([]);
  const [criteria, setCriteria] = useState<FilterCriteria>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const start = useCallback(
    async (coords: LatLng) => {
      setStatus("loading");
      try {
        setPool(await loadRestaurants(coords));
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [loadRestaurants],
  );

  useEffect(() => {
    if (autoStartCoords) void start(autoStartCoords);
  }, [autoStartCoords, start]);

  const filtered = useMemo(
    () => applyFilters(pool, origin, criteria),
    [pool, origin, criteria],
  );

  if (status === "loading") return <p className="p-6">Finding places near you…</p>;
  if (status === "error") return <p className="p-6">Something went wrong. Please try again.</p>;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <FilterControls value={criteria} onChange={setCriteria} />
      {filtered.length === 0 ? (
        <p>No restaurants match these filters. Try relaxing them.</p>
      ) : (
        filtered.map((rst) => <RestaurantCard key={rst.placeId} restaurant={rst} />)
      )}
    </div>
  );
}
