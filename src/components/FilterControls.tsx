"use client";

import type { FilterCriteria } from "@/lib/decision/filter";

interface Props {
  value: FilterCriteria;
  onChange: (next: FilterCriteria) => void;
}

export function FilterControls({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
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
