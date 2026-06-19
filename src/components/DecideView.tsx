"use client";

import { useState, useEffect, useCallback } from "react";
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { pickRandom } from "@/lib/decision/pick";
import { RestaurantCard } from "@/components/RestaurantCard";

interface Props {
  loadRestaurants: (coords: LatLng) => Promise<Restaurant[]>;
  autoStartCoords?: LatLng;          // test hook; in the page this comes from geolocation
  rng?: () => number;                // test hook
}

export function DecideView({ loadRestaurants, autoStartCoords, rng = Math.random }: Props) {
  const [pool, setPool] = useState<Restaurant[]>([]);
  const [current, setCurrent] = useState<Restaurant | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");

  const start = useCallback(
    async (coords: LatLng) => {
      setStatus("loading");
      try {
        const list = await loadRestaurants(coords);
        setPool(list);
        if (list.length === 0) {
          setStatus("empty");
          return;
        }
        setCurrent(pickRandom(list, undefined, rng));
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [loadRestaurants, rng],
  );

  useEffect(() => {
    if (autoStartCoords) void start(autoStartCoords);
  }, [autoStartCoords, start]);

  const again = () => setCurrent(pickRandom(pool, current?.placeId, rng));

  if (status === "loading") return <p className="p-6">Finding places near you…</p>;
  if (status === "empty") return <p className="p-6">No restaurants found nearby. Try moving or widening your search.</p>;
  if (status === "error") return <p className="p-6">Something went wrong loading restaurants. Please try again.</p>;
  if (status === "ready" && current) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <RestaurantCard restaurant={current} />
        <button
          onClick={again}
          className="rounded-xl bg-gray-900 px-4 py-2 font-medium text-white"
        >
          🎲 Pick again
        </button>
      </div>
    );
  }
  return <p className="p-6">Getting ready…</p>;
}
