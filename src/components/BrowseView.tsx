"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { applyFilters, type FilterCriteria } from "@/lib/decision/filter";
import { RestaurantCard } from "@/components/RestaurantCard";
import { FilterControls } from "@/components/FilterControls";
import { BackHome } from "@/components/BackHome";

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

  if (status === "loading")
    return (
      <main className="placemat flex min-h-screen flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-5xl">🔍</p>
        <p className="font-display text-xl font-bold">Finding places near you…</p>
      </main>
    );
  if (status === "error")
    return (
      <main className="placemat flex min-h-screen flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-5xl">😕</p>
        <p className="font-display text-xl font-bold">Something went wrong. Please try again.</p>
      </main>
    );

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <BackHome />
        <span className="font-mono text-xs text-ink-soft">{filtered.length} spots</span>
      </div>
      <h1 className="font-display text-2xl font-extrabold leading-tight">Browse nearby</h1>
      <FilterControls value={criteria} onChange={setCriteria} />
      {filtered.length === 0 ? (
        <p className="tile bg-white p-4 text-center text-ink-soft">
          No restaurants match these filters. Try relaxing them.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((rst) => (
            <RestaurantCard key={rst.placeId} restaurant={rst} />
          ))}
        </div>
      )}
    </main>
  );
}
