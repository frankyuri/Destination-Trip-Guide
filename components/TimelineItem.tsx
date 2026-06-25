import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarPlus,
  CheckCheck,
  Clock,
  Copy,
  Loader2,
  MapPin,
  MapPinned,
  ShoppingBag,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import { ItineraryItem } from '../types';
import { TransportIcon } from './TransportIcon';
import { NearbyRestaurants } from './NearbyRestaurants';
import { getPlaceInsight, isAiConfigured } from '../utils/gemini';
import { downloadICS } from '../utils/calendar';

interface TimelineItemProps {
  item: ItineraryItem;
  isoDate: string;
  isLast: boolean;
  onActive?: (id: string | null) => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({ item, isoDate, isLast, onActive }) => {
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [showNearbyRestaurants, setShowNearbyRestaurants] = useState(false);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.googleMapsQuery || item.address_jp)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.address_jp);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Address copy failed:', error);
    }
  };

  const handleAiInsight = async () => {
    if (aiInsight) {
      setAiInsight(null);
      return;
    }
    setAiLoading(true);
    setAiInsight(await getPlaceInsight(item.title));
    setAiLoading(false);
  };

  return (
    <article
      id={`item-${item.id}`}
      className="group relative scroll-mt-24 pb-10 pl-4 transition-all duration-300 md:scroll-mt-32 md:pb-12 md:pl-8"
      onMouseEnter={() => onActive?.(item.id)}
      onMouseLeave={() => onActive?.(null)}
    >
      {!isLast && (
        <div className="absolute bottom-0 left-[9px] top-6 w-[2px] bg-gradient-to-b from-primary-200 to-transparent transition-colors duration-500 group-hover:from-primary-400 md:left-[15px]" aria-hidden="true" />
      )}
      <div className="absolute left-0 top-6 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary-200 bg-surface-50 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:border-primary-500 group-hover:bg-primary-50 md:h-8 md:w-8" aria-hidden="true">
        <div className="h-1.5 w-1.5 rounded-full bg-primary-500 md:h-2.5 md:w-2.5" />
      </div>

      <div className="group/card relative rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-card md:rounded-2xl md:p-6 md:hover:-translate-y-1">
        <div className="mb-3 flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-50 px-2 py-1 text-xs font-bold text-primary-600 md:px-2.5 md:text-sm">
              <Clock size={14} aria-hidden="true" />
              <time dateTime={`${isoDate}T${item.time}:00+09:00`}>{item.time}</time>
            </div>
            <h3 className="text-lg font-black leading-tight text-gray-800 md:text-2xl">{item.title}</h3>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-primary-100 bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700 transition-colors hover:bg-primary-100 md:min-h-0 md:min-w-0 md:py-1"
              aria-label={`在 Google Maps 開啟 ${item.title}`}
            >
              <MapPin size={12} aria-hidden="true" />
              <span className="hidden md:inline">地圖</span>
            </a>
            <button
              type="button"
              onClick={handleAiInsight}
              disabled={aiLoading}
              className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-3 py-2 text-[10px] font-bold transition-all disabled:cursor-wait disabled:opacity-60 md:min-h-0 md:min-w-0 md:px-2 md:py-1 md:text-xs ${aiInsight ? 'border-purple-200 bg-purple-100 text-purple-700' : 'border-purple-100 bg-white text-purple-600 hover:bg-purple-50'}`}
              aria-expanded={Boolean(aiInsight)}
              title={isAiConfigured() ? 'AI 隱藏密技' : 'AI 後端尚未設定'}
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
              <span className="hidden md:inline">AI 密技</span>
            </button>
            <button
              type="button"
              onClick={() => downloadICS(item, isoDate)}
              className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-slate-100 bg-white px-3 py-2 text-[10px] font-bold text-slate-500 transition-all hover:bg-slate-50 md:min-h-0 md:min-w-0 md:px-2 md:py-1 md:text-xs"
              title="加入行事曆"
            >
              <CalendarPlus size={12} aria-hidden="true" />
              <span className="hidden md:inline">行事曆</span>
            </button>
            <span className="ml-1 hidden items-center gap-1 text-xs text-primary-400 opacity-0 transition-opacity group-hover/card:opacity-100 md:flex" aria-hidden="true">
              Open Map <ArrowRight size={12} />
            </span>
          </div>
        </div>

        {aiInsight && (
          <div className="relative mb-4 rounded-lg border border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 p-3" role="status">
            <button type="button" onClick={() => setAiInsight(null)} className="absolute right-2 top-2 min-h-11 min-w-11 text-purple-400 hover:text-purple-600 md:min-h-0 md:min-w-0" aria-label="關閉 AI 密技">
              <X size={14} aria-hidden="true" />
            </button>
            <div className="flex items-start gap-2 pr-8">
              <Sparkles size={16} className="mt-0.5 flex-shrink-0 text-purple-500" aria-hidden="true" />
              <p className="text-sm font-medium leading-relaxed text-purple-800">{aiInsight}</p>
            </div>
          </div>
        )}

        <div className="mb-4 pl-1 md:mb-5">
          <p className="mb-3 border-l-2 border-accent-red py-0.5 pl-3 text-sm font-medium leading-relaxed text-gray-600 md:text-base">{item.description}</p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-500">
            <TransportIcon type={item.transportType} />
            {item.transportDetail}
          </div>
        </div>

        <div className="space-y-4 border-t border-dashed border-gray-100 pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {item.recommendedFood.length > 0 && (
              <section className="space-y-2" aria-label="美食推薦">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400"><Utensils size={12} aria-hidden="true" /> 美食推薦</div>
                <div className="flex flex-wrap gap-2">
                  {item.recommendedFood.map((food) => <span key={food} className="rounded border border-orange-100/50 bg-orange-50/80 px-2 py-1 text-xs text-gray-700">{food}</span>)}
                </div>
              </section>
            )}
            {item.nearbySpots.length > 0 && (
              <section className="space-y-2" aria-label="順遊景點">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400"><MapPinned size={12} aria-hidden="true" /> 順遊景點</div>
                <div className="flex flex-wrap gap-2">
                  {item.nearbySpots.map((spot) => <span key={spot} className="rounded border border-indigo-100/50 bg-indigo-50/80 px-2 py-1 text-xs text-gray-700">{spot}</span>)}
                </div>
              </section>
            )}
          </div>

          {item.shoppingSideQuests && item.shoppingSideQuests.length > 0 && (
            <section className="rounded-lg border border-rose-100/50 bg-gradient-to-r from-rose-50/50 to-transparent p-3" aria-label="必買支線">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent-red"><ShoppingBag size={12} className="fill-current" aria-hidden="true" /> 必買支線</div>
              <div className="flex flex-col gap-2">
                {item.shoppingSideQuests.map((shop) => (
                  <div key={`${shop.name}-${shop.category}`} className="flex flex-wrap items-baseline gap-1 text-xs leading-relaxed md:flex-nowrap md:gap-2">
                    <span className="whitespace-nowrap font-bold text-rose-700">{shop.name}</span>
                    <span className="hidden text-rose-400 md:inline" aria-hidden="true">•</span>
                    <span className="block w-full border-l-2 border-rose-200 pl-2 text-gray-600 md:inline md:w-auto md:border-0 md:pl-0">{shop.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <NearbyRestaurants
            lat={item.coordinates.lat}
            lng={item.coordinates.lng}
            locationName={item.title}
            isExpanded={showNearbyRestaurants}
            onToggle={() => setShowNearbyRestaurants((current) => !current)}
          />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 md:mt-5 md:pt-4">
          <div className="flex min-w-0 items-center gap-2 pr-2 text-xs text-gray-400">
            <MapPin size={12} className="flex-shrink-0" aria-hidden="true" />
            <span className="truncate font-mono">{item.address_jp}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`min-h-11 min-w-11 flex-shrink-0 rounded-md p-2 transition-all md:min-h-0 md:min-w-0 md:p-1.5 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            title="複製地址"
            aria-live="polite"
          >
            {copied ? <CheckCheck size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  );
};