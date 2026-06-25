/**
 * foursquare.ts — Foursquare Places API v3 整合工具
 *
 * 功能：
 * - 搜尋指定座標附近的餐廳 / 咖啡廳
 * - 回傳比 Google Places 更豐富的資料（分類、價位、tips）
 * - 24 小時 localStorage 快取
 * - 無 API Key 時優雅降級
 *
 * Foursquare 免費版：100,000 calls/month
 */

// ======================================
// 型別定義
// ======================================

export interface FoursquareVenue {
  /** Foursquare venue ID */
  id: string;
  /** 餐廳名稱 */
  name: string;
  /** 分類（可能有多個） */
  categories: FoursquareCategory[];
  /** 距離（公尺） */
  distance: number;
  /** 地址 */
  address: string;
  /** 座標 */
  location: { lat: number; lng: number };
  /** 價位等級（1-4，$ 至 $$$$） */
  priceLevel?: number;
  /** 評分 */
  rating?: number;
  /** 是否營業中 */
  isOpen?: boolean;
  /** 照片 URL（如果有） */
  photoUrl?: string;
  /** 使用者評論摘要 */
  tips: string[];
}

export interface FoursquareCategory {
  /** 分類 ID */
  id: number;
  /** 分類名稱 */
  name: string;
  /** Emoji 圖示 */
  emoji: string;
}

export interface FoursquareResult {
  venues: FoursquareVenue[];
  apiUnavailable: boolean;
}

// ======================================
// 分類 Emoji 映射
// ======================================

/**
 * Foursquare 分類 ID → Emoji 映射
 * 完整清單：https://docs.foursquare.com/data-products/docs/categories
 */
const CATEGORY_EMOJI_MAP: Record<string, string> = {
  // 日式料理
  'Sushi Restaurant': '🍣',
  'Ramen Restaurant': '🍜',
  'Japanese Restaurant': '🍱',
  'Udon Restaurant': '🍜',
  'Soba Restaurant': '🍜',
  'Tempura Restaurant': '🍤',
  'Yakitori Restaurant': '🍗',
  'Tonkatsu Restaurant': '🥩',
  'Izakaya': '🍺',
  'Donburi Restaurant': '🍚',
  // 其他亞洲料理
  'Chinese Restaurant': '🥟',
  'Korean Restaurant': '🇰🇷',
  // 西式料理
  'Italian Restaurant': '🍝',
  'French Restaurant': '🇫🇷',
  'Pizza Place': '🍕',
  'Burger Joint': '🍔',
  'Steak House': '🥩',
  // 飲品 / 甜點
  'Coffee Shop': '☕',
  'Café': '☕',
  'Bubble Tea Shop': '🧋',
  'Dessert Shop': '🍰',
  'Bakery': '🥐',
  'Ice Cream Shop': '🍦',
  'Bar': '🍸',
  // 通用
  'Restaurant': '🍽️',
  'Fast Food Restaurant': '🍟',
  'Seafood Restaurant': '🦐',
  'Food Court': '🏬',
  'Convenience Store': '🏪',
};

/**
 * 取得分類的 Emoji
 */
const getCategoryEmoji = (categoryName: string): string => {
  // 精確比對
  if (CATEGORY_EMOJI_MAP[categoryName]) return CATEGORY_EMOJI_MAP[categoryName];
  // 模糊比對
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI_MAP)) {
    if (categoryName.toLowerCase().includes(key.toLowerCase())) return emoji;
  }
  return '🍽️'; // 預設
};

// ======================================
// 快取機制
// ======================================

import { createCache } from './cache';

const venueCache = createCache<FoursquareVenue[]>({
  prefix: 'fuka_fsq_',
  duration: 24 * 60 * 60 * 1000, // 24 小時
});

const makeCacheKey = (lat: number, lng: number, radius: number): string => {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return `${round(lat)}_${round(lng)}_${radius}`;
};

// ======================================
// 主要搜尋函數
// ======================================

/**
 * 搜尋附近的 Foursquare 餐廳
 *
 * @param lat - 緯度
 * @param lng - 經度
 * @param radius - 搜尋半徑（公尺），預設 500
 * @returns 餐廳列表 + API 是否可用
 */
export const searchFoursquareVenues = async (
  lat: number,
  lng: number,
  radius: number = 500
): Promise<FoursquareResult> => {
  // 1. 檢查 API Key
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    console.warn('[Foursquare] 未設定 FOURSQUARE_API_KEY，跳過餐廳搜尋');
    return { venues: [], apiUnavailable: true };
  }

  // 2. 檢查快取
  const cacheKey = makeCacheKey(lat, lng, radius);
  const cached = venueCache.get(cacheKey);
  if (cached) {
    return { venues: cached, apiUnavailable: false };
  }

  // 3. 呼叫 Foursquare Places API v3
  try {
    const params = new URLSearchParams({
      ll: `${lat},${lng}`,
      radius: String(radius),
      // 搜尋所有餐飲相關分類
      categories: '13000', // 13000 = Dining and Drinking
      limit: '15',
      sort: 'DISTANCE',
      fields: 'fsq_id,name,categories,distance,location,price,rating,hours,tips,photos',
    });

    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?${params}`,
      {
        headers: {
          Authorization: apiKey,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('[Foursquare] API Key 無效或已達用量限制');
      } else {
        console.warn(`[Foursquare] API 錯誤: ${response.status}`);
      }
      return { venues: [], apiUnavailable: true };
    }

    const data = await response.json();
    const results = data.results || [];

    const venues: FoursquareVenue[] = results.map((place: any) => {
      // 處理分類
      const categories: FoursquareCategory[] = (place.categories || []).map(
        (cat: any) => ({
          id: cat.id,
          name: cat.name || 'Restaurant',
          emoji: getCategoryEmoji(cat.name || ''),
        })
      );

      // 處理照片
      let photoUrl: string | undefined;
      if (place.photos && place.photos.length > 0) {
        const p = place.photos[0];
        photoUrl = `${p.prefix}300x200${p.suffix}`;
      }

      // 處理 tips（使用者評論）
      const tips: string[] = (place.tips || [])
        .slice(0, 2)
        .map((tip: any) => tip.text || '')
        .filter(Boolean);

      return {
        id: place.fsq_id,
        name: place.name,
        categories,
        distance: place.distance || 0,
        address: place.location?.formatted_address || place.location?.address || '',
        location: {
          lat: place.geocodes?.main?.latitude || lat,
          lng: place.geocodes?.main?.longitude || lng,
        },
        priceLevel: place.price,
        rating: place.rating ? Math.round(place.rating * 10) / 10 : undefined,
        isOpen: place.hours?.open_now,
        photoUrl,
        tips,
      };
    });

    venueCache.set(cacheKey, venues);
    return { venues, apiUnavailable: false };
  } catch (error) {
    console.error('[Foursquare] 搜尋錯誤:', error);
    return { venues: [], apiUnavailable: true };
  }
};

// ======================================
// 工具函數
// ======================================

/**
 * 格式化價位等級
 */
export const formatPriceLevel = (level?: number): string => {
  if (!level) return '';
  return '$'.repeat(level);
};

/**
 * 取得評分的顏色 class
 */
export const getRatingColor = (rating: number): string => {
  if (rating >= 8) return 'bg-green-100 text-green-700';
  if (rating >= 6) return 'bg-yellow-100 text-yellow-700';
  return 'bg-orange-100 text-orange-700';
};
