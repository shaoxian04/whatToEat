"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { applyFilters, cuisineOptions, type FilterCriteria } from "@/lib/decision/filter";
import { rankRestaurants } from "@/lib/decision/score";
import { RestaurantCard } from "@/components/RestaurantCard";
import { FilterControls, DEFAULT_DISTANCE } from "@/components/FilterControls";
import { BackHome } from "@/components/BackHome";

const MAX_SELECTED = 50;
const TOP_PICKS_N = 4;

interface Props {
  loadRestaurants: (coords: LatLng, radiusMeters: number) => Promise<Restaurant[]>;
  origin: LatLng;
  autoStartCoords?: LatLng;
  onVoteWithTeam?: (picks: Restaurant[]) => void;
  areaLabel?: string;
  onChangeArea?: () => void;
}

export function BrowseView({
  loadRestaurants, origin, autoStartCoords, onVoteWithTeam, areaLabel, onChangeArea,
}: Props) {
  const [pool, setPool] = useState<Restaurant[]>([]);
  const [criteria, setCriteria] = useState<FilterCriteria>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const radius = criteria.maxDistanceMeters ?? DEFAULT_DISTANCE;
  const hasLoaded = pool.length > 0 || status === "ready";

  const start = useCallback(
    async (coords: LatLng, radiusMeters: number, initial: boolean) => {
      if (initial) setStatus("loading");
      else setRefreshing(true);
      try {
        setPool(await loadRestaurants(coords, radiusMeters));
        setStatus("ready");
      } catch {
        setStatus("error");
      } finally {
        setRefreshing(false);
      }
    },
    [loadRestaurants],
  );

  // The search radius is a fetch parameter (Google returns the top 20 within
  // it), so changing distance re-queries instead of just filtering.
  useEffect(() => {
    if (autoStartCoords) void start(autoStartCoords, radius, !hasLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasLoaded only picks the loading style
  }, [autoStartCoords, start, radius]);

  const cuisines = useMemo(() => cuisineOptions(pool), [pool]);

  const filtered = useMemo(
    () => applyFilters(pool, origin, criteria),
    [pool, origin, criteria],
  );

  const ranked = useMemo(
    () => rankRestaurants(filtered, origin).map((s) => s.restaurant),
    [filtered, origin],
  );

  const toggle = useCallback((placeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else if (next.size < MAX_SELECTED) next.add(placeId);
      return next;
    });
  }, []);

  const startVote = useCallback(() => {
    if (!onVoteWithTeam) return;
    onVoteWithTeam(pool.filter((rst) => selectedIds.has(rst.placeId)));
  }, [onVoteWithTeam, pool, selectedIds]);

  const seedTopPicks = useCallback(() => {
    if (!onVoteWithTeam) return;
    onVoteWithTeam(ranked.slice(0, TOP_PICKS_N));
  }, [onVoteWithTeam, ranked]);

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

  const selectable = !!onVoteWithTeam;
  const count = selectedIds.size;

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <BackHome />
        <span className="font-mono text-xs text-ink-soft" aria-live="polite">
          {refreshing ? "Searching…" : `${filtered.length} spots`}
        </span>
      </div>
      <div>
        <h1 className="font-display text-2xl font-extrabold leading-tight">Browse nearby</h1>
        {(areaLabel || onChangeArea) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-xs text-ink-soft">
            {areaLabel && <span className="min-w-0 truncate">📍 {areaLabel}</span>}
            {onChangeArea && (
              <button type="button" onClick={onChangeArea} className="font-bold text-tomato-ink underline">
                Change area
              </button>
            )}
          </p>
        )}
      </div>
      <FilterControls value={criteria} onChange={setCriteria} cuisines={cuisines} />
      {selectable && ranked.length >= 2 && (
        <button
          type="button"
          onClick={seedTopPicks}
          className="tile tile-press w-full bg-mustard px-4 py-3 text-center font-display text-lg font-bold text-ink"
        >
          ⭐ Vote with top {Math.min(TOP_PICKS_N, ranked.length)} picks
        </button>
      )}
      {filtered.length === 0 ? (
        <p className="tile bg-white p-4 text-center text-ink-soft">
          No restaurants match these filters. Try relaxing them.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {ranked.map((rst) => (
            <RestaurantCard
              key={rst.placeId}
              restaurant={rst}
              selectable={selectable}
              selected={selectedIds.has(rst.placeId)}
              onToggle={() => toggle(rst.placeId)}
            />
          ))}
        </div>
      )}

      {selectable && count > 0 && (
        <div className="sticky bottom-4 mt-2">
          <button
            type="button"
            onClick={startVote}
            disabled={count < 2}
            className="tile tile-press w-full bg-herb px-4 py-3 text-center font-display text-lg font-bold text-ink disabled:opacity-60"
          >
            {count < 2 ? "Pick 2+ to vote" : `🗳️ Vote with team (${count})`}
          </button>
        </div>
      )}
    </main>
  );
}
