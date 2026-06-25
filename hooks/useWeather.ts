/**
 * useWeather.ts - 統一天氣資料 Hook
 * 
 * 提供單一天氣資料來源，避免 WeatherWidget 和 CountdownWidget 各自 fetch。
 * 使用 localStorage 快取，4 小時過期。
 */

import { useState, useEffect } from 'react';

// Fukuoka coordinates
const FUKUOKA_LAT = 33.5902;
const FUKUOKA_LNG = 130.4017;

const CACHE_KEY = 'weather_cache_fukuoka_v2';
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

export interface WeatherData {
  current?: {
    temperature: number;
    weatherCode: number;
  };
  daily: {
    dates: string[];
    maxTemps: number[];
    minTemps: number[];
    weatherCodes: number[];
    precipProbabilities: number[];
  };
  fetchedAt: number;
}

/**
 * Singleton promise to ensure only one fetch happens at a time,
 * even if multiple components mount simultaneously.
 */
let inflightFetch: Promise<WeatherData | null> | null = null;

const fetchWeatherData = async (): Promise<WeatherData | null> => {
  // Check cache first
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const cached: WeatherData = JSON.parse(stored);
      if (Date.now() - cached.fetchedAt < CACHE_DURATION) {
        return cached;
      }
    }
  } catch (e) {
    console.warn('Weather cache read error', e);
  }

  // Deduplicate in-flight requests
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${FUKUOKA_LAT}&longitude=${FUKUOKA_LNG}&` +
        `current=temperature_2m,weather_code&` +
        `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&` +
        `timezone=Asia%2FTokyo`
      );

      if (!response.ok) throw new Error(`Weather API: ${response.status}`);

      const data = await response.json();

      const weatherData: WeatherData = {
        current: data.current ? {
          temperature: Math.round(data.current.temperature_2m),
          weatherCode: data.current.weather_code,
        } : undefined,
        daily: {
          dates: data.daily.time || [],
          maxTemps: (data.daily.temperature_2m_max || []).map((t: number) => Math.round(t)),
          minTemps: (data.daily.temperature_2m_min || []).map((t: number) => Math.round(t)),
          weatherCodes: data.daily.weather_code || [],
          precipProbabilities: data.daily.precipitation_probability_max || [],
        },
        fetchedAt: Date.now(),
      };

      // Cache to localStorage
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(weatherData));
      } catch (e) {
        console.warn('Weather cache write error', e);
      }

      return weatherData;
    } catch (err) {
      console.error('Weather fetch error:', err);
      return null;
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
};

/**
 * Hook that provides unified weather data.
 * Multiple components can call this hook; only one API request will be made.
 */
export const useWeather = () => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(false);
      const result = await fetchWeatherData();
      if (!cancelled) {
        if (result) {
          setData(result);
        } else {
          setError(true);
        }
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
};
