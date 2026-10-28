"use client";

import type { CuisineOption, FilterCriteria } from "@/lib/decision/filter";

export const DISTANCE_CHOICES = [500, 1000, 1500, 3000, 5000] as const;
export const DEFAULT_DISTANCE = 1500;

const distanceLabel = (m: number) => (m < 1000 ? `${m} m` : `${m / 1000} km`);

interface Props {
  value: FilterCriteria;
  onChange: (next: FilterCriteria) => void;
  cuisines?: CuisineOption[];
}

export function FilterControls({ value, onChange, cuisines = [] }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <label className="tile-sm flex items-center gap-1.5 bg-white px-3 py-1.5 text-sm font-semibold">
        <span className="text-ink-soft">Within</span>
        <select
          aria-label="Maximum distance"
          className="cursor-pointer bg-transparent font-bold text-ink outline-none"
          value={value.maxDistanceMeters ?? DEFAULT_DISTANCE}
          onChange={(e) => onChange({ ...value, maxDistanceMeters: Number(e.target.value) })}
        >
          {DISTANCE_CHOICES.map((m) => (
            <option key={m} value={m}>{distanceLabel(m)}</option>
          ))}
        </select>
      </label>

      {cuisines.length > 0 && (
        <label className="tile-sm flex items-center gap-1.5 bg-white px-3 py-1.5 text-sm font-semibold">
          <span className="text-ink-soft">Cuisine</span>
          <select
            aria-label="Cuisine"
            className="max-w-[9rem] cursor-pointer bg-transparent font-bold text-ink outline-none"
            value={value.cuisine ?? ""}
            onChange={(e) => onChange({ ...value, cuisine: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {cuisines.map((c) => (
              <option key={c.value} value={c.value}>{`${c.label} (${c.count})`}</option>
            ))}
          </select>
        </label>
      )}

      <label className="tile-sm flex items-center gap-1.5 bg-white px-3 py-1.5 text-sm font-semibold">
        <span className="text-ink-soft">Rating</span>
        <select
          aria-label="Minimum rating"
          className="cursor-pointer bg-transparent font-bold text-ink outline-none"
          value={value.minRating ?? ""}
          onChange={(e) =>
            onChange({ ...value, minRating: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Any</option>
          <option value="3.5">3.5+</option>
          <option value="4">4.0+</option>
          <option value="4.5">4.5+</option>
        </select>
      </label>

      <label className="tile-sm flex items-center gap-1.5 bg-white px-3 py-1.5 text-sm font-semibold">
        <span className="text-ink-soft">Price</span>
        <select
          aria-label="Maximum price"
          className="cursor-pointer bg-transparent font-bold text-ink outline-none"
          value={value.maxPriceLevel ?? ""}
          onChange={(e) =>
            onChange({ ...value, maxPriceLevel: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Any</option>
          <option value="1">$</option>
          <option value="2">$$</option>
          <option value="3">$$$</option>
        </select>
        {value.maxPriceLevel !== undefined && (
          <span className="font-mono text-[10px] text-ink-soft">+ unknown</span>
        )}
      </label>

      <label className="tile-sm flex cursor-pointer items-center gap-1.5 bg-white px-3 py-1.5 text-sm font-semibold">
        <input
          type="checkbox"
          aria-label="Open now"
          className="size-4 accent-herb"
          checked={value.openNow === true}
          onChange={(e) => onChange({ ...value, openNow: e.target.checked ? true : undefined })}
        />
        Open now
      </label>
    </div>
  );
}
