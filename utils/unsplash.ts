/**
 * unsplash.ts — Unsplash API 整合工具
 *
 * 功能：
 * - 根據景點名稱搜尋相關照片
 * - 24 小時 localStorage 快取，減少 API 呼叫
 * - 無 API Key 時優雅降級（回傳 null）
 *
 * Unsplash 免費版限制：50 req/hr
 * 注意：使用時需顯示攝影師姓名（Unsplash TOS）
 */

// ======================================
// 型別定義
// ======================================

export interface PlacePhotoResult {
  /** 照片 URL（regular 尺寸，約 1080px 寬） */
  url: string;
  /** 小尺寸預覽 URL（約 400px 寬） */
  smallUrl: string;
  /** 攝影師名稱 */
  photographer: string;
  /** 攝影師 Unsplash 頁面連結 */
  photographerUrl: string;
  /** 照片的 Unsplash 頁面（用於 attribution） */
  photoLink: string;
  /** 照片寬度 */
  width: number;
  /** 照片高度 */
  height: number;
}

// ======================================
// 快取機制
// ======================================

import { createCache } from './cache';

// Cache supports null values (meaning "no photo found" — avoids re-querying)
const photoCache = createCache<PlacePhotoResult | null>({
  prefix: 'fuka_unsplash_',
  duration: 24 * 60 * 60 * 1000, // 24 小時
});

/**
 * Check cache — returns undefined if not cached, null if cached-as-empty, or the result
 */
const getFromPhotoCache = (query: string): PlacePhotoResult | null | undefined => {
  const key = btoa(encodeURIComponent(query));
  // We store null explicitly to mean "no result". We rely on the cache returning null
  // for both "not found in cache" and "cached as null". To distinguish, we check localStorage directly.
  try {
    const raw = localStorage.getItem('fuka_unsplash_' + key);
    if (!raw) return undefined; // not cached at all
  } catch {
    return undefined;
  }
  // Entry exists — delegate to cache (handles expiry)
  const result = photoCache.get(key);
  if (result === null) {
    // Cache returned null — could be expired (entry deleted) or cached-as-null
    try {
      const raw = localStorage.getItem('fuka_unsplash_' + key);
      if (!raw) return undefined; // expired and removed
    } catch {
      return undefined;
    }
    return null; // genuinely cached as null
  }
  return result;
};

const saveToPhotoCache = (query: string, data: PlacePhotoResult | null): void => {
  const key = btoa(encodeURIComponent(query));
  photoCache.set(key, data);
};

// ======================================
// 主要搜尋函數
// ======================================

/**
 * 搜尋景點相關照片
 *
 * @param placeName - 景點名稱（如 "博多運河城"）
 * @returns 照片結果，無結果或錯誤時回傳 null
 *
 * @example
 * const photo = await searchPlacePhoto('太宰府天滿宮');
 * if (photo) {
 *   console.log(photo.url);            // 照片 URL
 *   console.log(photo.photographer);   // 攝影師名稱
 * }
 */
export const searchPlacePhoto = async (
  placeName: string
): Promise<PlacePhotoResult | null> => {
  // 1. 檢查 API Key
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn('[Unsplash] 未設定 UNSPLASH_ACCESS_KEY，跳過照片載入');
    return null;
  }

  // 2. 檢查快取
  const cached = getFromPhotoCache(placeName);
  if (cached !== undefined) {
    return cached;
  }

  // 3. 呼叫 API
  try {
    const query = encodeURIComponent(`${placeName} Fukuoka Japan`);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        console.warn('[Unsplash] API Key 無效或已達速率限制');
      } else {
        console.warn(`[Unsplash] API 錯誤: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      saveToPhotoCache(placeName, null); // 快取 "無結果"
      return null;
    }

    const photo = data.results[0];
    const result: PlacePhotoResult = {
      url: photo.urls?.regular || photo.urls?.small,
      smallUrl: photo.urls?.small || photo.urls?.thumb,
      photographer: photo.user?.name || 'Unknown',
      photographerUrl: `${photo.user?.links?.html || 'https://unsplash.com'}?utm_source=fukuoka_trip_guide&utm_medium=referral`,
      photoLink: `${photo.links?.html || 'https://unsplash.com'}?utm_source=fukuoka_trip_guide&utm_medium=referral`,
      width: photo.width || 1080,
      height: photo.height || 720,
    };

    saveToPhotoCache(placeName, result);
    return result;
  } catch (error) {
    console.error('[Unsplash] 搜尋錯誤:', error);
    return null;
  }
};
