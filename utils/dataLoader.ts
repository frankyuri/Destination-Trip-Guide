/**
 * dataLoader.ts - 資料載入器
 * 
 * 用於載入 JSON 格式的行程資料，並轉換為 TypeScript 型別
 */

import { DayItinerary, ItineraryItem, TransportType, ShoppingSpot } from '../types';

// 定義行程方案類型
export type ItineraryPlanType = 'plan1' | 'plan2';

// 方案一：原始行程
import day1Data from '../data/itinerary/day1.json';
import day2Data from '../data/itinerary/day2.json';
import day3Data from '../data/itinerary/day3.json';
import day4Data from '../data/itinerary/day4.json';

// 方案二：備選行程
import day1Data2 from '../data/itinerary2/day1.json';
import day2Data2 from '../data/itinerary2/day2.json';
import day3Data2 from '../data/itinerary2/day3.json';
import day4Data2 from '../data/itinerary2/day4.json';

/**
 * JSON 格式的行程項目（transportType 是字串）
 * shoppingSideQuests 可以是字串陣列或 ShoppingSpot 陣列
 */
interface RawItineraryItem {
  id: string;
  time: string;
  title: string;
  description: string;
  address_jp: string;
  address_en: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  transportType: string;
  transportDetail: string;
  googleMapsQuery?: string;
  recommendedFood: string[];
  nearbySpots: string[];
  shoppingSideQuests?: (string | ShoppingSpot)[];
}

/**
 * JSON 格式的每日行程
 */
interface RawDayItinerary {
  isoDate?: string;
  date: string;
  dayTitle: string;
  theme: string;
  focus: string;
  items: RawItineraryItem[];
}

/**
 * 從 "M/D (X)" 格式推算 ISO 日期 (2026 年)
 * 例: "2/27 (五)" → "2026-02-27"
 */
const deriveIsoDate = (dateStr: string): string => {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!match) return '2026-01-01';
  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  return `2026-${month}-${day}`;
};

/**
 * 將字串轉換為 TransportType enum
 */
const parseTransportType = (type: string): TransportType => {
  const mapping: Record<string, TransportType> = {
    'TAXI': TransportType.TAXI,
    'WALK': TransportType.WALK,
    'TRAIN': TransportType.TRAIN,
    'BUS': TransportType.BUS,
    'SHIP': TransportType.SHIP,
    'FLIGHT': TransportType.FLIGHT,
  };
  return mapping[type] || TransportType.WALK;
};

/**
 * 將 shoppingSideQuests 轉換為統一的 ShoppingSpot[] 格式
 * 支援字串陣列或 ShoppingSpot 陣列輸入
 */
const parseShoppingSideQuests = (quests?: (string | ShoppingSpot)[]): ShoppingSpot[] | undefined => {
  if (!quests || quests.length === 0) return undefined;
  
  return quests.map((quest): ShoppingSpot => {
    if (typeof quest === 'string') {
      // 字串轉換為 ShoppingSpot 物件
      return {
        name: quest,
        category: '購物',
        description: undefined,
      };
    }
    return quest;
  });
};

/**
 * 將原始 JSON 資料轉換為型別安全的 DayItinerary
 */
const parseDayItinerary = (raw: RawDayItinerary): DayItinerary => {
  return {
    isoDate: raw.isoDate ?? deriveIsoDate(raw.date),
    date: raw.date,
    dayTitle: raw.dayTitle,
    theme: raw.theme,
    focus: raw.focus,
    items: raw.items.map((item): ItineraryItem => ({
      id: item.id,
      time: item.time,
      title: item.title,
      description: item.description,
      address_jp: item.address_jp,
      address_en: item.address_en,
      coordinates: item.coordinates,
      transportType: parseTransportType(item.transportType),
      transportDetail: item.transportDetail,
      googleMapsQuery: item.googleMapsQuery,
      recommendedFood: item.recommendedFood,
      nearbySpots: item.nearbySpots,
      shoppingSideQuests: parseShoppingSideQuests(item.shoppingSideQuests),
    })),
  };
};

/**
 * 載入所有行程資料
 * @returns 所有天數的行程資料陣列
 */
export const loadItineraryData = (): DayItinerary[] => {
  const rawData: RawDayItinerary[] = [
    day1Data as RawDayItinerary,
    day2Data as RawDayItinerary,
    day3Data as RawDayItinerary,
    day4Data as RawDayItinerary,
  ];

  return rawData.map(parseDayItinerary);
};

/**
 * 載入特定天數的行程資料
 * @param dayNumber - 天數 (1-4)
 * @returns 該天的行程資料，若不存在則回傳 undefined
 */
export const loadDayItinerary = (dayNumber: number): DayItinerary | undefined => {
  const allData = loadItineraryData();
  return allData[dayNumber - 1];
};

/**
 * 載入備選二行程資料
 * @returns 備選二所有天數的行程資料陣列
 */
export const loadItineraryData2 = (): DayItinerary[] => {
  const rawData: RawDayItinerary[] = [
    day1Data2 as RawDayItinerary,
    day2Data2 as RawDayItinerary,
    day3Data2 as RawDayItinerary,
    day4Data2 as RawDayItinerary,
  ];

  return rawData.map(parseDayItinerary);
};

/**
 * 根據方案類型載入行程資料
 * @param plan - 方案類型 ('plan1' | 'plan2')
 * @returns 對應方案的行程資料陣列
 */
export const loadItineraryByPlan = (plan: ItineraryPlanType): DayItinerary[] => {
  return plan === 'plan1' ? loadItineraryData() : loadItineraryData2();
};

