export interface LatLng {
  lat: number;
  lng: number;
}

export interface Restaurant {
  placeId: string;
  name: string;
  rating: number | null;
  userRatingCount?: number | null; // number of reviews behind `rating`; absent on legacy data
  priceLevel: number | null; // 1 (cheapest) .. 4
  lat: number;
  lng: number;
  openNow: boolean | null;
  types: string[];
  photoRef: string | null;
}
