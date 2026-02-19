import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Copy,
  CheckCheck,
  Utensils,
  MapPinned,
  Clock,
  ShoppingBag,
  ArrowRight,
  ExternalLink, // Added
  MessageCircle, // Added
  Sparkles,
  CalendarPlus,
  Loader2,
  X,
  Trash2,
  Search // Added
} from 'lucide-react';
import { ItineraryItem, TransportType } from '../types';
import { TransportIcon } from './TransportIcon';
// import { NearbyRestaurants } from './NearbyRestaurants'; // Refactored to Lazy Load
const NearbyRestaurants = React.lazy(() => import('./NearbyRestaurants').then(m => ({ default: m.NearbyRestaurants })));
const FoursquareRestaurants = React.lazy(() => import('./FoursquareRestaurants').then(m => ({ default: m.FoursquareRestaurants })));
import { getPlaceInsight } from '../utils/gemini';
import { searchNearbyRestaurants, searchPlaceByName } from '../utils/places';
import { downloadICS } from '../utils/exportImport';
// Removed static ITINERARY_DATA import — dayDate is now passed as prop
import { ProgressCheckbox } from './ProgressTracker';
import { PlacePhoto } from './PlacePhoto';

interface TimelineItemProps {
  item: ItineraryItem;
  isLast: boolean;
  dayDate: string;
  isActive?: boolean;
  onActive?: (id: string | null) => void;
  onRestaurantHover?: (location: { lat: number, lng: number } | null) => void;
  isCompleted?: boolean;
  onToggleComplete?: (id: string) => void;
  index?: number;
  isEditing?: boolean;
  onUpdate?: (updatedItem: ItineraryItem) => void;
  onDelete?: (id: string) => void;
}

/**
 * Sanitize HTML to prevent XSS from AI-generated content.
 * Strips <script>, <iframe>, on* event handlers, and javascript: URIs.
 */
const sanitizeHtml = (html: string): string => {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*\S+/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
};

export const TimelineItem = React.memo<TimelineItemProps>(({
  item,
  isLast,
  dayDate,
  isActive = false,
  onActive,
  onRestaurantHover,
  isCompleted = false,
  onToggleComplete,
  index = 0,
  isEditing = false,
  onUpdate,
  onDelete
}) => {
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [showNearbyRestaurants, setShowNearbyRestaurants] = useState(false);
  const [restaurantSource, setRestaurantSource] = useState<'google' | 'foursquare'>('google');

  // Stable refs to avoid stale closures in useEffect
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const itemRef = useRef(item);
  itemRef.current = item;

  // Auto-lookup state
  const [isSearching, setIsSearching] = useState(false);

  // Manual search trigger
  const handleTitleSearch = async () => {
    if (!item.title || item.title.length < 2) return;

    setIsSearching(true);
    try {
      const result = await searchPlaceByName(item.title);
      if (result && onUpdate) {
        onUpdate({
          ...item,
          address_jp: result.address || item.address_jp,
          coordinates: { lat: result.lat, lng: result.lng },
          googleMapsQuery: result.name
        });

        // Sync Map: Focus on this item to fly to new coords
        setTimeout(() => {
          onActive?.(item.id);
        }, 100);
      }
    } catch (e) {
      console.error('Manual lookup failed', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTimeBlur = (val: string) => {
    // Basic Time Validation (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeRegex.test(val)) {
      // Format to HH:MM (e.g., 9:00 -> 09:00)
      const [h, m] = val.split(':');
      const formatted = `${h.padStart(2, '0')}:${m}`;
      if (formatted !== item.time) {
        handleUpdate('time', formatted);
      }
    } else {
      console.warn('Invalid time format');
      // Optional: Toast error here
    }
  };

  // Debounce logic for title changes - KEEPING it for auto-suggestions or just background update?
  // User asked for "Save" button specifically. Maybe disable auto-debounce if manual button exists to avoid double firing?
  // Or keep auto-debounce as a "nice to have" fallback but rely on button for immediate feedback.
  // Let's keep auto-debounce but ensure handleTitleSearch can also be called.
  useEffect(() => {
    if (!isEditing || !item.title) return;
    if (item.title.length < 2) return;

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const currentItem = itemRef.current;
        const result = await searchPlaceByName(currentItem.title);
        if (result && onUpdateRef.current) {
          onUpdateRef.current({
            ...currentItem,
            address_jp: result.address || currentItem.address_jp,
            coordinates: { lat: result.lat, lng: result.lng },
            googleMapsQuery: result.name
          });
        }
      } catch (e) {
        console.error('Auto lookup failed', e);
      } finally {
        setIsSearching(false);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [item.title, isEditing]);

  const handleUpdate = (field: keyof ItineraryItem, value: string) => {
    if (onUpdate) {
      onUpdate({ ...item, [field]: value });
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.address_jp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCardClick = (e: React.MouseEvent) => { // Added event arg
    // Prevent opening map when clicking inside inputs
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
      return;
    }

    if (isActive) {
      // Already active? Open maps — use coordinates for reliable mobile app navigation
      const query = encodeURIComponent(item.googleMapsQuery || item.address_jp);
      const hasCoords = item.coordinates && item.coordinates.lat && item.coordinates.lng;
      const mapsUrl = hasCoords
        ? `https://www.google.com/maps/search/?api=1&query=${query}&center=${item.coordinates.lat},${item.coordinates.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(mapsUrl, '_blank');
    } else {
      // Not active? Set as active (focus map)
      onActive?.(item.id);
    }
  };

  const handleAiInsight = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (aiInsight) {
      setAiInsight(null); // Toggle off
      return;
    }

    setAiLoading(true);

    // 同時搜尋附近餐廳，一起丟給 AI 做諮詢
    try {
      const { restaurants } = await searchNearbyRestaurants(
        item.coordinates.lat,
        item.coordinates.lng,
        500
      );
      const insight = await getPlaceInsight(item.title, restaurants);
      setAiInsight(insight);
    } catch (error) {
      const insight = await getPlaceInsight(item.title);
      setAiInsight(insight);
    }

    setAiLoading(false);
  };

  const handleCalendarExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadICS(item, dayDate);
  };

  return (
    <div
      id={`item-${item.id}`}
      style={{
        animationDelay: `${index * 100}ms`,
        contentVisibility: 'auto', // Browser-native virtualization
        containIntrinsicSize: '0 400px' // Placeholder height to prevent scrollbar jumping
      } as React.CSSProperties}
      className={`relative pl-4 md:pl-8 pb-10 md:pb-12 group scroll-mt-24 md:scroll-mt-32 transition-all duration-300 ${isActive ? 'z-10' : ''} animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards`}
    // Removed onMouseEnter auto-focus to prevent accidental map movements
    // onMouseEnter={() => onActive?.(item.id)}
    // onMouseLeave={() => onActive?.(null)}
    >
      {/* Timeline Connector */}
      {!isLast && (
        <div className="absolute left-[9px] md:left-[15px] top-6 bottom-0 w-[2px] bg-gradient-to-b from-primary-200 to-transparent group-hover:from-primary-400 transition-colors duration-500"></div>
      )}

      {/* Timeline Node - Now clickable for progress tracking */}
      <div
        className={`absolute left-0 top-6 w-5 h-5 md:w-8 md:h-8 rounded-full shadow-sm z-10 flex items-center justify-center transition-all duration-300 cursor-pointer
          ${isCompleted
            ? 'bg-green-500 border-2 border-green-500'
            : 'bg-surface-50 border-2 border-primary-200 group-hover:border-primary-500 group-hover:scale-110 group-hover:bg-primary-50'
          }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.(item.id);
        }}
        title={isCompleted ? '標記為未完成' : '標記為已完成'}
      >
        {isCompleted ? (
          <CheckCheck size={14} className="text-white" />
        ) : (
          <div className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 bg-primary-500 rounded-full"></div>
        )}
      </div>

      {/* Main Card */}
      <div
        onClick={handleCardClick}
        className={`relative rounded-xl md:rounded-2xl shadow-sm hover:shadow-card border p-4 md:p-6 transition-all duration-300 transform md:hover:-translate-y-1 cursor-pointer group/card active:scale-[0.99]
          ${isActive ? 'ring-2 ring-primary-400 ring-offset-2' : ''}
          ${isCompleted
            ? 'bg-green-50/50 border-green-200'
            : 'bg-white border-gray-100'
          }`}
      >
        {/* Completed Badge */}
        {isCompleted && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <CheckCheck size={10} />
            已完成
          </div>
        )}

        {/* Header: Time & Title */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-start md:items-center gap-2 md:gap-3 flex-col md:flex-row w-full relative">

            {/* Time Input */}
            <div className={`flex items-center gap-1.5 text-primary-600 font-bold bg-primary-50 px-2 py-1 md:px-2.5 md:py-1 rounded-md text-xs md:text-sm whitespace-nowrap transition-all ${isEditing ? 'bg-white border border-primary-200 shadow-sm focus-within:ring-2 focus-within:ring-primary-300' : ''}`}>
              <Clock size={12} className="md:w-[14px] md:h-[14px]" />
              {isEditing ? (
                <input
                  type="text"
                  defaultValue={item.time} // Uncontrolled for safer typing
                  onBlur={(e) => handleTimeBlur(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  className="bg-transparent w-20 outline-none text-center font-mono"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                item.time
              )}
            </div>

            {/* Title Input & Searching Spinner */}
            {isEditing ? (
              <div className="relative w-full flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    defaultValue={item.title}
                    onBlur={(e) => handleUpdate('title', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSearch();
                    }}
                    className="text-base md:text-2xl font-black text-gray-800 leading-tight bg-white border border-gray-200 rounded-lg pl-3 pr-10 py-2 md:py-1 outline-none w-full focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all shadow-sm"
                    placeholder="輸入景點名稱..."
                    onClick={(e) => e.stopPropagation()}
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 animate-spin">
                      <Loader2 size={16} />
                    </div>
                  )}
                </div>
                {/* Search Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTitleSearch();
                  }}
                  className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:scale-95 transition-all shadow-sm flex-shrink-0"
                  title="搜尋並儲存位置"
                >
                  <Search size={18} />
                </button>
              </div>
            ) : (
              <h3 className="text-lg md:text-2xl font-black text-gray-800 leading-tight">
                {item.title}
              </h3>
            )}

          </div>

          {/* Action Buttons — scrollable on narrow mobile */}
          <div className="flex items-center gap-1.5 md:gap-2 mt-1 md:mt-0 overflow-x-auto no-scrollbar flex-shrink-0">
            {isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(item.id);
                }}
                className="flex items-center justify-center p-1.5 rounded-full text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
                title="刪除行程"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={handleAiInsight}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] md:text-xs font-bold border transition-all ${aiInsight
                ? 'bg-purple-100 text-purple-700 border-purple-200'
                : 'bg-white text-purple-600 border-purple-100 hover:bg-purple-50'
                }`}
              title="AI 隱藏密技"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span className="hidden md:inline">AI 密技</span>
            </button>
            <button
              onClick={handleCalendarExport}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] md:text-xs font-bold bg-white text-slate-500 border border-slate-100 hover:bg-slate-50 transition-all"
              title="加入行事曆"
            >
              <CalendarPlus size={12} />
              <span className="hidden md:inline">行事曆</span>
            </button>
            <div className="hidden md:flex opacity-0 group-hover/card:opacity-100 transition-opacity text-primary-400 text-xs items-center gap-1 ml-2">
              {isActive ? (
                <>Open Map <ArrowRight size={12} /></>
              ) : (
                <>Click to Focus <MapPinned size={12} /></>
              )}
            </div>
          </div>
        </div>

        {/* AI Insight Content */}
        {/* ... (AI Insight) ... */}
        {aiInsight && (
          <div className="mb-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-lg p-3 animate-in fade-in slide-in-from-top-2 relative">
            <button
              onClick={(e) => { e.stopPropagation(); setAiInsight(null); }}
              className="absolute top-2 right-2 text-purple-300 hover:text-purple-500"
            >
              <X size={14} />
            </button>
            <div className="flex gap-2 items-start">
              <Sparkles size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
              <div
                className="text-sm text-purple-800 leading-relaxed font-medium prose prose-sm prose-purple max-w-none
                  [&>p]:mb-2 [&>p:last-child]:mb-0
                  [&_strong]:text-purple-900 [&_strong]:font-bold
                  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-1
                  [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(
                    aiInsight
                      .replace(/\n\n/g, '</p><p>')
                      .replace(/\n/g, '<br/>')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^/, '<p>')
                      .replace(/$/, '</p>')
                  )
                }}
              />
            </div>
          </div>
        )}

        {/* Place Photo (Unsplash) — 只在展開時載入 */}
        <PlacePhoto placeName={item.title} enabled={isActive} />

        {/* Description & Transport */}
        <div className="mb-4 md:mb-5 pl-1">
          {isEditing ? (
            <textarea
              defaultValue={item.description}
              onBlur={(e) => handleUpdate('description', e.target.value)}
              className="w-full text-base font-medium mb-3 border-l-2 border-primary-200 pl-3 py-3 md:py-2 leading-relaxed bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all shadow-sm min-h-[80px]"
              onClick={(e) => e.stopPropagation()}
              placeholder="輸入行程說明..."
            />
          ) : (
            <p className="text-gray-600 text-sm md:text-base font-medium mb-3 border-l-2 border-accent-red pl-3 py-0.5 leading-relaxed">
              {item.description}
            </p>
          )}

          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-500">
            <TransportIcon type={item.transportType} />
            {item.transportDetail}
          </div>
        </div>

        {/* Info Grid (Food/Nearby/Shopping) */}
        <div className="space-y-4 border-t border-dashed border-gray-100 pt-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Food */}
            {item.recommendedFood.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Utensils size={12} /> 美食推薦
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.recommendedFood.map((food, i) => (
                    <span key={i} className="text-xs text-gray-700 bg-orange-50/80 px-2 py-1 rounded border border-orange-100/50">
                      {food}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Nearby */}
            {item.nearbySpots.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPinned size={12} /> 順遊景點
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.nearbySpots.map((spot, i) => (
                    <span key={i} className="text-xs text-gray-700 bg-indigo-50/80 px-2 py-1 rounded border border-indigo-100/50">
                      {spot}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Shopping Quest */}
          {item.shoppingSideQuests && item.shoppingSideQuests.length > 0 && (
            <div className="bg-gradient-to-r from-rose-50/50 to-transparent p-3 rounded-lg border border-rose-100/50">
              <div className="text-[10px] font-bold text-accent-red uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <ShoppingBag size={12} className="fill-current" />
                必買支線
              </div>
              <div className="flex flex-col gap-2">
                {item.shoppingSideQuests.map((shop, i) => (
                  <div key={i} className="flex flex-wrap md:flex-nowrap items-baseline gap-1 md:gap-2 text-xs leading-relaxed">
                    <span className="font-bold text-rose-700 whitespace-nowrap">{shop.name}</span>
                    <span className="text-rose-400 hidden md:inline">•</span>
                    <span className="text-gray-600 block md:inline w-full md:w-auto pl-2 md:pl-0 border-l-2 md:border-l-0 border-rose-200 md:border-none">{shop.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nearby Restaurants */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Utensils size={12} /> 附近美食
            </div>

            {showNearbyRestaurants && (
              <div className="flex bg-gray-100 p-0.5 rounded-lg">
                <button
                  onClick={(e) => { e.stopPropagation(); setRestaurantSource('google'); }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${restaurantSource === 'google' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  Google
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setRestaurantSource('foursquare'); }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${restaurantSource === 'foursquare' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  Foursquare
                </button>
              </div>
            )}
          </div>

          <React.Suspense fallback={
            <div className="h-12 w-full bg-gray-50 rounded-lg animate-pulse flex items-center justify-center text-xs text-gray-400">
              載入餐廳資訊元件...
            </div>
          }>
            {restaurantSource === 'google' ? (
              <NearbyRestaurants
                lat={item.coordinates.lat}
                lng={item.coordinates.lng}
                locationName={item.title}
                isExpanded={showNearbyRestaurants}
                onToggle={() => setShowNearbyRestaurants(!showNearbyRestaurants)}
                onHover={onRestaurantHover}
              />
            ) : (
              <div className="mt-2">
                {!showNearbyRestaurants ? (
                  <button
                    onClick={() => setShowNearbyRestaurants(true)}
                    className="w-full py-2 text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors border border-primary-100"
                  >
                    顯示 Foursquare 美食推薦
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowNearbyRestaurants(false)}
                      className="w-full py-1 text-xs text-gray-400 hover:text-gray-600 mb-2 transition-colors"
                    >
                      隱藏列表
                    </button>
                    <FoursquareRestaurants
                      lat={item.coordinates.lat}
                      lng={item.coordinates.lng}
                      isExpanded={true}
                      onHover={onRestaurantHover}
                    />
                  </>
                )}
              </div>
            )}
          </React.Suspense>

        </div>

        {/* Footer: Address */}
        <div className="mt-4 md:mt-5 pt-3 md:pt-4 border-t border-gray-100 flex items-center justify-between group/addr gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0 flex-1">
            <MapPin size={12} className="flex-shrink-0" />
            <span className="truncate font-mono group-hover/addr:text-primary-600 transition-colors">{item.address_jp}</span>
          </div>
          <button
            onClick={handleCopy}
            className={`p-2 md:p-1.5 rounded-md transition-all flex-shrink-0 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            title="複製地址"
          >
            {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
          </button>
        </div>

      </div>
    </div>
  );
});