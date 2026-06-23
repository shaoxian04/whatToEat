export function priceLabel(level: number | null): string {
  return level ? "$".repeat(level) : "";
}

export function mapsUrl(name: string, placeId: string): string {
  return (
    `https://www.google.com/maps/search/?api=1&query=` +
    `${encodeURIComponent(name)}&query_place_id=${placeId}`
  );
}
