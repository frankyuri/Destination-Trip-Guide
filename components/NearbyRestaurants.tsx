import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader2, MapPin, Navigation, Star } from 'lucide-react';
import { formatDistance, formatPriceLevel, NearbyRestaurant, searchNearbyRestaurants } from '../utils/places';

interface NearbyRestaurantsProps {
  lat: number;
  lng: number;
  locationName: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export const NearbyRestaurants: React.FC<NearbyRestaurantsProps> = ({
  lat,
  lng,
  locationName,
  isExpanded,
  onToggle,
}) => {
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelId = `nearby-restaurants-${lat}-${lng}`.replace(/\./g, '-');

  useEffect(() => {
    if (!isExpanded || restaurants.length > 0 || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    searchNearbyRestaurants(lat, lng, 500)
      .then((results) => {
        if (!cancelled) setRestaurants(results);
      })
      .catch((requestError: unknown) => {
        console.error('Nearby restaurant search failed:', requestError);
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : '無法載入附近餐廳');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isExpanded, restaurants.length, loading, lat, lng]);

  return (
    <section className="mt-4 border-t border-gray-100 pt-4" aria-label={`${locationName}附近餐廳`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 p-3 transition-all hover:from-orange-100 hover:to-amber-100"
        aria-expanded={isExpanded}
        aria-controls={panelId}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-orange-700">
          <span className="text-lg" aria-hidden="true">🍜</span>
          附近 500m 餐廳
        </span>
        {isExpanded ? <ChevronUp size={18} className="text-orange-500" aria-hidden="true" /> : <ChevronDown size={18} className="text-orange-500" aria-hidden="true" />}
      </button>

      {isExpanded && (
        <div id={panelId} className="mt-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-orange-500" role="status">
              <Loader2 className="mr-2 animate-spin" size={20} aria-hidden="true" />
              <span className="text-sm">搜尋中…</span>
            </div>
          )}

          {error && <p className="py-4 text-center text-sm text-red-600" role="alert">{error}</p>}
          {!loading && !error && restaurants.length === 0 && <p className="py-4 text-center text-sm text-gray-400">附近沒有找到餐廳</p>}

          {!loading && restaurants.map((restaurant) => {
            const query = encodeURIComponent(`${restaurant.name} ${restaurant.address}`);
            return (
              <a
                key={restaurant.placeId}
                href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block min-h-11 rounded-lg border border-gray-100 bg-white p-3 transition-all hover:border-orange-200 hover:shadow-sm"
                aria-label={`在 Google Maps 開啟 ${restaurant.name}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-bold text-gray-800 transition-colors group-hover:text-orange-600">{restaurant.name}</h4>
                      {restaurant.isOpen !== undefined && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${restaurant.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {restaurant.isOpen ? '營業中' : '休息中'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      {restaurant.rating !== undefined && (
                        <span className="flex items-center gap-0.5 font-medium text-amber-500">
                          <Star size={12} className="fill-current" aria-hidden="true" />
                          {restaurant.rating}
                          {restaurant.userRatingsTotal !== undefined && <span className="ml-0.5 text-gray-400">({restaurant.userRatingsTotal > 999 ? `${(restaurant.userRatingsTotal / 1000).toFixed(1)}k` : restaurant.userRatingsTotal})</span>}
                        </span>
                      )}
                      {restaurant.priceLevel !== undefined && <span className="font-medium text-green-600">{formatPriceLevel(restaurant.priceLevel)}</span>}
                      {restaurant.distance !== undefined && <span className="flex items-center gap-0.5"><Navigation size={10} aria-hidden="true" />{formatDistance(restaurant.distance)}</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400">
                      <MapPin size={10} aria-hidden="true" />
                      <span className="truncate">{restaurant.address}</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="mt-1 flex-shrink-0 text-gray-300 group-hover:text-orange-400" aria-hidden="true" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
};