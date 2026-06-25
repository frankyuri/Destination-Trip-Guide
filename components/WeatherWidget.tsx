import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSun, CloudDrizzle, Snowflake, CloudLightning, Loader2, WifiOff, CalendarX2 } from 'lucide-react';

interface WeatherWidgetProps {
  isoDate: string;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

interface WeatherState {
  tempHigh: number;
  tempLow: number;
  condition: string;
  icon: React.ReactNode;
  precip: number;
}

let weatherCache: { data: OpenMeteoResponse; timestamp: number } | null = null;

const getWeatherIcon = (code: number) => {
  const iconProps = { size: 28 };
  if (code === 0) return <Sun className="text-orange-500" {...iconProps} />;
  if (code <= 3) return <CloudSun className="text-amber-400" {...iconProps} />;
  if (code <= 48) return <Cloud className="text-slate-400" {...iconProps} />;
  if (code <= 57) return <CloudDrizzle className="text-blue-400" {...iconProps} />;
  if (code <= 67) return <CloudRain className="text-blue-500" {...iconProps} />;
  if (code <= 77) return <Snowflake className="text-cyan-300" {...iconProps} />;
  if (code <= 82) return <CloudRain className="text-blue-600" {...iconProps} />;
  if (code <= 86) return <Snowflake className="text-cyan-400" {...iconProps} />;
  if (code >= 95) return <CloudLightning className="text-purple-500" {...iconProps} />;
  return <CloudSun className="text-slate-500" {...iconProps} />;
};

const getWeatherConditionText = (code: number): string => {
  if (code === 0) return '晴朗';
  if (code === 1) return '大致晴朗';
  if (code === 2) return '多雲時晴';
  if (code === 3) return '陰天';
  if (code <= 48) return '起霧';
  if (code <= 55) return '毛毛雨';
  if (code <= 57) return '凍雨';
  if (code <= 65) return '下雨';
  if (code <= 67) return '冰雨';
  if (code <= 77) return '下雪';
  if (code <= 82) return '陣雨';
  if (code <= 86) return '陣雪';
  if (code >= 95) return '雷雨';
  return '天氣不明';
};

const parseWeather = (data: OpenMeteoResponse, isoDate: string): WeatherState | null => {
  const targetIndex = data.daily.time.indexOf(isoDate);
  if (targetIndex < 0) return null;

  const code = data.daily.weather_code[targetIndex];
  return {
    tempHigh: Math.round(data.daily.temperature_2m_max[targetIndex]),
    tempLow: Math.round(data.daily.temperature_2m_min[targetIndex]),
    condition: getWeatherConditionText(code),
    icon: getWeatherIcon(code),
    precip: data.daily.precipitation_probability_max[targetIndex] ?? 0,
  };
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ isoDate }) => {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [outOfRange, setOutOfRange] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const applyData = (data: OpenMeteoResponse) => {
      const result = parseWeather(data, isoDate);
      setWeather(result);
      setOutOfRange(result === null);
      setLoading(false);
    };

    if (weatherCache && Date.now() - weatherCache.timestamp < 10 * 60_000) {
      applyData(weatherCache.data);
      return () => controller.abort();
    }

    const fetchWeather = async () => {
      setLoading(true);
      setError(false);
      setOutOfRange(false);
      try {
        const response = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=33.5902&longitude=130.4017&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=16&timezone=Asia%2FTokyo',
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
        const data = (await response.json()) as OpenMeteoResponse;
        weatherCache = { data, timestamp: Date.now() };
        applyData(data);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        console.error('Weather fetch error:', fetchError);
        setError(true);
        setLoading(false);
      }
    };

    void fetchWeather();
    return () => controller.abort();
  }, [isoDate]);

  if (loading) {
    return (
      <div className="inline-flex h-[60px] w-full max-w-[210px] items-center justify-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-3 shadow-sm backdrop-blur-md md:h-[72px]">
        <Loader2 className="animate-spin text-primary-400" size={20} aria-hidden="true" />
        <span className="text-xs font-medium text-slate-500">更新天氣中…</span>
      </div>
    );
  }

  if (outOfRange) {
    return (
      <div className="inline-flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-3 pr-5 shadow-sm backdrop-blur-md">
        <CalendarX2 className="text-slate-400" size={22} aria-hidden="true" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-500">{isoDate}</span>
          <span className="text-xs text-slate-400">尚未進入 16 日預報範圍</span>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="inline-flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-3 pr-5 shadow-sm backdrop-blur-md">
        <WifiOff className="text-slate-400" size={20} aria-hidden="true" />
        <span className="text-sm font-medium text-slate-500">天氣暫時無法連線</span>
      </div>
    );
  }

  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-3 pr-5 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-md md:gap-4">
      <div className="flex-shrink-0 rounded-full bg-blue-50 p-2.5 shadow-inner" aria-hidden="true">{weather.icon}</div>
      <div className="flex min-w-0 flex-col items-start">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-slate-400 md:text-xs">Forecast</span>
          {weather.precip > 0 && (
            <span className="flex whitespace-nowrap rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
              <CloudRain size={10} className="mr-1" aria-hidden="true" /> {weather.precip}%
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-xl font-black tracking-tight text-slate-700 md:text-2xl">{weather.tempHigh}°</span>
          <span className="text-xs font-semibold text-slate-400 md:text-sm">/ {weather.tempLow}°</span>
          <span className="ml-1 border-l border-slate-200 pl-2 text-xs font-medium text-slate-600 md:text-sm">{weather.condition}</span>
        </div>
      </div>
    </div>
  );
};