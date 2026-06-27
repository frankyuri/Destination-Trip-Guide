import { DayItinerary } from '../types';
import { ITINERARY_DATA } from '../constants';
import { ItineraryPlanType, loadItineraryData2 } from './dataLoader';

const DB_NAME = 'destination-trip-db';
const STORE_NAME = 'itineraries';
const STORE_NAME_2 = 'itineraries2'; // 備選二的 store
const DB_VERSION = 2; // 升級版本以支援新 store

/**
 * 根據方案取得對應的 store 名稱
 */
const getStoreName = (plan: ItineraryPlanType): string => {
  return plan === 'plan1' ? STORE_NAME : STORE_NAME_2;
};

/**
 * 根據方案取得對應的預設資料
 */
const getDefaultData = (plan: ItineraryPlanType): DayItinerary[] => {
  return plan === 'plan1' ? ITINERARY_DATA : loadItineraryData2();
};

/**
 * Initialize the database (Native API)
 */
/** Cached DB connection — avoids opening a new IDB connection on every operation */
let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', (event.target as IDBOpenDBRequest).error);
      dbPromise = null; // Reset so next call retries
      reject((event.target as IDBOpenDBRequest).error);
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Reset cache if connection is closed externally
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // 方案一 store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'date' });
      }
      // 方案二 store
      if (!db.objectStoreNames.contains(STORE_NAME_2)) {
        db.createObjectStore(STORE_NAME_2, { keyPath: 'date' });
      }
    };
  });

  return dbPromise;
};

/**
 * Get all itineraries from DB for specified plan.
 * If DB is empty, seeds it with default data.
 */
export const getAllItineraries = async (plan: ItineraryPlanType = 'plan1'): Promise<DayItinerary[]> => {
  const storeName = getStoreName(plan);
  const defaultData = getDefaultData(plan);
  
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = async () => {
        const items = request.result as DayItinerary[];
        if (items.length === 0) {
          // Seed DB with default data
          console.log(`Seeding DB with default ${plan} itinerary data...`);
          await seedDatabase(db, plan);
          resolve(defaultData); // Return default data immediately
        } else {
          resolve(items);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting itineraries:', error);
    return defaultData; // Fallback
  }
};

const seedDatabase = async (db: IDBDatabase, plan: ItineraryPlanType = 'plan1'): Promise<void> => {
  const storeName = getStoreName(plan);
  const defaultData = getDefaultData(plan);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    defaultData.forEach(day => {
      store.put(day);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * Save a single day itinerary to DB
 */
export const saveDayItinerary = async (day: DayItinerary, plan: ItineraryPlanType = 'plan1'): Promise<void> => {
  const storeName = getStoreName(plan);
  
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(day);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error saving itinerary:', error);
    // Dispatch global event for UI to catch
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('db-error', { 
        detail: { message: '無法儲存行程，請檢查您的瀏覽器設定 (如：隱私模式)' } 
      });
      window.dispatchEvent(event);
    }
  }
};

/**
 * Delete a single day itinerary from DB
 */
export const deleteDayItinerary = async (dayDate: string, plan: ItineraryPlanType = 'plan1'): Promise<void> => {
  const storeName = getStoreName(plan);

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(dayDate);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error deleting day itinerary:', error);
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('db-error', {
        detail: { message: '無法刪除行程，請檢查您的瀏覽器設定' }
      });
      window.dispatchEvent(event);
    }
  }
};

/**
 * Reset DB to default data for specified plan
 */
export const resetItineraries = async (plan: ItineraryPlanType = 'plan1'): Promise<DayItinerary[]> => {
  const storeName = getStoreName(plan);
  const defaultData = getDefaultData(plan);
  
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const clearRequest = store.clear();

      clearRequest.onsuccess = async () => {
        // Re-seed with default data
        seedDatabase(db, plan).then(() => {
             resolve(defaultData);
        });
      };
      
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  } catch (error) {
     console.error('Error resetting itineraries:', error);
     return defaultData;
  }
};

