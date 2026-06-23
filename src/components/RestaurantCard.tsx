import type { Restaurant } from "@/lib/decision/types";
import { priceLabel, mapsUrl } from "@/lib/restaurant-format";

interface Props {
  restaurant: Restaurant;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}

export function RestaurantCard({ restaurant, selectable = false, selected = false, onToggle }: Props) {
  const url = mapsUrl(restaurant.name, restaurant.placeId);

  return (
    <div className={`ticket p-4 ${selectable && selected ? "ring-2 ring-herb" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 font-display text-lg font-bold leading-tight">{restaurant.name}</h2>
        {selectable && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            aria-label={selected ? `Remove ${restaurant.name} from vote` : `Add ${restaurant.name} to vote`}
            className="tile-sm tile-press shrink-0 bg-herb/15 px-2 py-1 text-sm font-bold text-herb-ink"
          >
            {selected ? "✓ Added" : "+ Vote"}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-xs font-medium">
        <span className="rounded-full border-[1.5px] border-ink bg-paper-2 px-2 py-0.5">
          {restaurant.rating !== null ? `★ ${restaurant.rating}` : "No rating"}
        </span>
        {restaurant.priceLevel !== null && (
          <span className="rounded-full border-[1.5px] border-ink bg-paper-2 px-2 py-0.5">
            {priceLabel(restaurant.priceLevel)}
          </span>
        )}
        {restaurant.openNow === true && (
          <span className="rounded-full border-[1.5px] border-ink bg-herb/20 px-2 py-0.5 text-herb-ink">
            Open now
          </span>
        )}
        {restaurant.openNow === false && (
          <span className="rounded-full border-[1.5px] border-ink bg-tomato/15 px-2 py-0.5 text-tomato-ink">
            Closed
          </span>
        )}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="tile-sm tile-press mt-3 inline-flex w-fit items-center gap-1 bg-tomato px-3 py-1.5 text-sm font-bold text-ink"
      >
        Directions →
      </a>
    </div>
  );
}
