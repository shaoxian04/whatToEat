import type { Restaurant } from "@/lib/decision/types";

function priceLabel(level: number | null): string {
  return level ? "$".repeat(level) : "";
}

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const mapsUrl =
    `https://www.google.com/maps/search/?api=1&query=` +
    `${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.placeId}`;

  return (
    <div className="ticket p-4">
      <h2 className="font-display text-lg font-bold leading-tight">{restaurant.name}</h2>

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
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="tile-sm tile-press mt-3 inline-flex w-fit items-center gap-1 bg-tomato px-3 py-1.5 text-sm font-bold text-ink"
      >
        Directions →
      </a>
    </div>
  );
}
