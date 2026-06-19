"use client";

import type { FilterCriteria } from "@/lib/decision/filter";

interface Props {
  value: FilterCriteria;
  onChange: (next: FilterCriteria) => void;
}

export function FilterControls({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="text-sm">
        Minimum rating
        <select
          aria-label="Minimum rating"
          className="ml-2 rounded border px-2 py-1"
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

      <label className="text-sm">
        Max price
        <select
          aria-label="Maximum price"
          className="ml-2 rounded border px-2 py-1"
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

      <label className="flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          aria-label="Open now"
          checked={value.openNow === true}
          onChange={(e) => onChange({ ...value, openNow: e.target.checked ? true : undefined })}
        />
        Open now
      </label>
    </div>
  );
}
