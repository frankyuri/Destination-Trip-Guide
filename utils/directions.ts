/**
 * directions.ts — Mapbox Directions API 整合工具
 *
 * 功能：
 * - 查詢兩點之間的實際路線（步行 / 開車）
 * - 回傳路線幾何座標、預估時間、距離
 * - 24 小時 localStorage 快取
 * - 無 API Token 時優雅降級（回傳 null，地圖回退為直線）
 *
 * Mapbox 免費版限制：100,000 requests/month
 */

import { TransportType } from '../types';

// ======================================
// 型別定義
// ======================================

export interface RouteResult {
  /** 路線座標陣列 [lat, lng][] */
  geometry: [number, number][];
  /** 預估時間（秒） */
  duration: number;
  /** 距離（公尺） */
  distance: number;
  /** 使用的 Mapbox profile */
  profile: string;
}

// ======================================
// TransportType → Mapbox Profile 映射
// ======================================

type MapboxProfile = 'walking' | 'driving' | 'cycling';

/**
 * 將行程中的交通方式對應到 Mapbox routing profile
 */
const getMapboxProfile = (transportType: TransportType): MapboxProfile => {
  switch (transportType) {
    case TransportType.WALK:
      return 'walking';
    case TransportType.TAXI:
    case TransportType.BUS:
    case TransportType.SHIP:
    case TransportType.FLIGHT:
      return 'driving';
    case TransportType.TRAIN:
      return 'driving'; // Mapbox 沒有鐵路 routing，用開車近似
    default:
      return 'walking';
  }
};

// ======================================
// 快取機制
// ======================================

import { createCache } from './cache';

const routeCache = createCache<RouteResult>({
  prefix: 'fuka_directions_',
  duration: 24 * 60 * 60 * 1000, // 24 小時
});

/**
 * 產生快取 key（基於起終點和模式）
 */
const makeCacheKey = (
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  profile: string
): string => {
  // 四捨五入到小數第四位，避免因微小差異造成快取失效
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return `${round(startLat)}_${round(startLng)}_${round(endLat)}_${round(endLng)}_${profile}`;
};

// ======================================
// 主要查詢函數
// ======================================

/**
 * 查詢兩點之間的路線
 *
 * @param startLat - 起點緯度
 * @param startLng - 起點經度
 * @param endLat - 終點緯度
 * @param endLng - 終點經度
 * @param transportType - 交通方式（用來決定 routing profile）
 * @returns 路線結果，失敗時回傳 null
 *
 * @example
 * const route = await fetchRoute(33.5902, 130.4017, 33.5855, 130.4265, TransportType.WALK);
 * if (route) {
 *   console.log(`${route.duration}秒, ${route.distance}公尺`);
 *   console.log(route.geometry); // [[lat, lng], ...]
 * }
 */
export const fetchRoute = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  transportType: TransportType
): Promise<RouteResult | null> => {
  // 1. 檢查 API Token
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    // 無 Token，靜默回傳 null（呼叫端會 fallback 為直線）
    return null;
  }

  const profile = getMapboxProfile(transportType);

  // 2. 檢查快取
  const cacheKey = makeCacheKey(startLat, startLng, endLat, endLng, profile);
  const cached = routeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 3. 呼叫 Mapbox Directions API
  // 注意：Mapbox 使用 lng,lat 順序（不同於 Leaflet 的 lat,lng）
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full&access_token=${token}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('[Mapbox] API Token 無效或已達用量限制');
      } else {
        console.warn(`[Mapbox] API 錯誤: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.warn('[Mapbox] 查無路線');
      return null;
    }

    const route = data.routes[0];
    const coordinates = route.geometry.coordinates;

    // Mapbox 回傳 [lng, lat]，轉換為 Leaflet 的 [lat, lng]
    const geometry: [number, number][] = coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]]
    );

    const result: RouteResult = {
      geometry,
      duration: Math.round(route.duration), // 秒
      distance: Math.round(route.distance), // 公尺
      profile,
    };

    routeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Mapbox] 路線查詢錯誤:', error);
    return null;
  }
};

// ======================================
// 格式化工具
// ======================================

/**
 * 將秒數格式化為可讀的時間字串
 * @example formatDuration(720) // "12 min"
 * @example formatDuration(3600) // "1 hr"
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * 將公尺格式化為可讀的距離字串
 * @example formatRouteDistance(350) // "350m"
 * @example formatRouteDistance(1500) // "1.5km"
 */
export const formatRouteDistance = (meters: number): string => {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};
