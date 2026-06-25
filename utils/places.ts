type GoogleMapsWindow = Window & { google?: typeof globalThis.google };

export interface NearbyRestaurant {
  placeId: string;
  name: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  address: string;
  isOpen?: boolean;
  distance?: number;
  types: string[];
}

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const radius = 6_371_000;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const restaurantCache = new Map<string, { data: NearbyRestaurant[]; timestamp: number }>();
const CACHE_DURATION = 30 * 60_000;
let googleMapsPromise: Promise<void> | null = null;

const loadGoogleMaps = (): Promise<void> => {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  const googleWindow = window as GoogleMapsWindow;
  if (googleWindow.google?.maps?.places) return Promise.resolve();
  if (!apiKey) return Promise.reject(new Error('Google Places API 尚未設定'));
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('Google Maps 載入逾時')), 12_000);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&language=ja`;
    script.async = true;
    script.dataset.googleMapsLoader = 'true';
    script.onload = () => {
      window.clearTimeout(timeout);
      if (googleWindow.google?.maps?.places) resolve();
      else reject(new Error('Google Places 程式庫未載入'));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Google Maps 載入失敗'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = null;
    document.querySelector('script[data-google-maps-loader="true"]')?.remove();
    throw error;
  });

  return googleMapsPromise as Promise<void>;
};

export const searchNearbyRestaurants = async (lat: number, lng: number, radius = 500): Promise<NearbyRestaurant[]> => {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
  const cached = restaurantCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

  await loadGoogleMaps();
  const googleMaps = (window as GoogleMapsWindow).google;
  if (!googleMaps?.maps?.places) throw new Error('Google Places 程式庫無法使用');

  const service = new googleMaps.maps.places.PlacesService(document.createElement('div'));
  const location = new googleMaps.maps.LatLng(lat, lng);

  return new Promise((resolve, reject) => {
    service.nearbySearch(
      { location, radius, type: 'restaurant', language: 'ja' },
      (results, status) => {
        if (status === googleMaps.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
          return;
        }
        if (status !== googleMaps.maps.places.PlacesServiceStatus.OK || !results) {
          reject(new Error(`Google Places 查詢失敗：${status}`));
          return;
        }

        const restaurants = results
          .filter((place): place is google.maps.places.PlaceResult & { place_id: string; name: string; geometry: { location: google.maps.LatLng } } =>
            Boolean(place.place_id && place.name && place.geometry?.location),
          )
          .slice(0, 10)
          .map((place): NearbyRestaurant => ({
            placeId: place.place_id,
            name: place.name,
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            priceLevel: place.price_level,
            address: place.vicinity || '',
            isOpen: place.opening_hours?.isOpen?.() ?? place.opening_hours?.open_now,
            distance: calculateDistance(lat, lng, place.geometry.location.lat(), place.geometry.location.lng()),
            types: place.types || [],
          }))
          .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

        restaurantCache.set(cacheKey, { data: restaurants, timestamp: Date.now() });
        resolve(restaurants);
      },
    );
  });
};

export const formatPriceLevel = (level?: number): string => level === undefined ? '' : '¥'.repeat(level);

export const formatDistance = (meters?: number): string => {
  if (meters === undefined) return '';
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
};
