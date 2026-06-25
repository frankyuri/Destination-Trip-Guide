/**
 * cache.ts — Shared localStorage cache utility
 *
 * Provides a factory function for creating typed localStorage caches
 * with configurable prefix, duration, and support for nullable values.
 *
 * Used by: directions.ts, unsplash.ts, foursquare.ts
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheOptions {
  /** localStorage key prefix */
  prefix: string;
  /** Cache duration in milliseconds */
  duration: number;
}

/**
 * Creates a typed localStorage cache.
 *
 * @example
 * const cache = createCache<RouteResult>({ prefix: 'fuka_directions_', duration: 24 * 60 * 60 * 1000 });
 * const cached = cache.get('some_key');
 * cache.set('some_key', result);
 */
export const createCache = <T>({ prefix, duration }: CacheOptions) => ({
  get(key: string): T | null {
    try {
      const stored = localStorage.getItem(prefix + key);
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      if (Date.now() - entry.timestamp < duration) {
        return entry.data;
      }

      localStorage.removeItem(prefix + key);
    } catch {
      // ignore
    }
    return null;
  },

  set(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      localStorage.setItem(prefix + key, JSON.stringify(entry));
    } catch {
      // localStorage full or unavailable — ignore
    }
  },
});
