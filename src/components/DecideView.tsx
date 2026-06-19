"use client";

import { useState, useEffect, useCallback } from "react";
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { pickRandom } from "@/lib/decision/pick";
import { RestaurantCard } from "@/components/RestaurantCard";
import { BackHome } from "@/components/BackHome";

interface Props {
  loadRestaurants: (coords: LatLng) => Promise<Restaurant[]>;
  autoStartCoords?: LatLng; // test hook; in the page this comes from geolocation
  rng?: () => number; // test hook
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-8">
      <BackHome />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">{children}</div>
    </main>
  );
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

  const again = useCallback(
    () => setCurrent(pickRandom(pool, current?.placeId, rng)),
    [pool, current, rng],
  );

  if (status === "loading")
    return (
      <Shell>
        <p className="text-5xl">🎲</p>
        <p className="font-display text-xl font-bold">Finding places near you…</p>
      </Shell>
    );
  if (status === "empty")
    return (
      <Shell>
        <p className="text-5xl">🍽️</p>
        <p className="font-display text-xl font-bold">No restaurants found nearby.</p>
        <p className="text-ink-soft">Try moving or widening your search.</p>
      </Shell>
    );
  if (status === "error")
    return (
      <Shell>
        <p className="text-5xl">😕</p>
        <p className="font-display text-xl font-bold">Something went wrong loading restaurants.</p>
        <p className="text-ink-soft">Please try again.</p>
      </Shell>
    );
  if (status === "ready" && current) {
    return (
      <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-5 py-8">
        <BackHome />
        <div className="flex flex-1 flex-col justify-center gap-5">
          <div className="flex justify-center">
            <span className="stamp inline-block bg-paper px-3 py-1 font-mono text-xs font-bold text-tomato-ink">
              TODAY&apos;S PICK
            </span>
          </div>
          <div key={current.placeId} className="pop-in">
            <RestaurantCard restaurant={current} />
          </div>
          <button
            onClick={again}
            className="tile tile-press bg-mustard px-4 py-3 text-center font-display text-lg font-bold text-ink"
          >
            🎲 Pick again
          </button>
        </div>
      </main>
    );
  }
  return (
    <Shell>
      <p className="font-display text-xl font-bold">Getting ready…</p>
    </Shell>
  );
}
