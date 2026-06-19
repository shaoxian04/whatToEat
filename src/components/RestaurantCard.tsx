import type { Restaurant } from "@/lib/decision/types";

function priceLabel(level: number | null): string {
  return level ? "$".repeat(level) : "";
}

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const mapsUrl =
    `https://www.google.com/maps/search/?api=1&query=` +
    `${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.placeId}`;

  return (
    <div className="rounded-2xl border border-gray-200 p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{restaurant.name}</h2>
      <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-600">
        <span>{restaurant.rating !== null ? `★ ${restaurant.rating}` : "No rating"}</span>
        {restaurant.priceLevel !== null && <span>{priceLabel(restaurant.priceLevel)}</span>}
        {restaurant.openNow === true && <span className="text-green-600">Open now</span>}
        {restaurant.openNow === false && <span className="text-red-600">Closed</span>}
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
      >
        Directions
      </a>
    </div>
  );
}
