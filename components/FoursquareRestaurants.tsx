import React, { useState, useEffect } from 'react';
import {
    Utensils,
    MapPin,
    Star,
    Clock,
    ExternalLink,
    Coffee,
    Beer,
    Search,
    Loader2,
    AlertCircle
} from 'lucide-react';
import {
    searchFoursquareVenues,
    FoursquareVenue,
    formatPriceLevel,
    getRatingColor
} from '../utils/foursquare';

interface FoursquareRestaurantsProps {
    lat: number;
    lng: number;
    isExpanded: boolean;
    onHover?: (location: { lat: number; lng: number } | null) => void;
}

// 分類篩選選項
const FILTER_CHIPS = [
    { label: '全部', value: 'ALL', icon: <Utensils size={12} /> },
    { label: '正餐', value: 'meal', icon: <Utensils size={12} /> }, // 包含壽司、拉麵、牛排等
    { label: '咖啡甜點', value: 'cafe', icon: <Coffee size={12} /> }, // 包含咖啡、麵包、甜點
    { label: '小酌', value: 'bar', icon: <Beer size={12} /> }, // 包含居酒屋、酒吧
];

export const FoursquareRestaurants: React.FC<FoursquareRestaurantsProps> = ({
    lat,
    lng,
    isExpanded,
    onHover
}) => {
    const [venues, setVenues] = useState<FoursquareVenue[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [activeFilter, setActiveFilter] = useState('ALL');

    useEffect(() => {
        if (!isExpanded) return;

        // 避免重複載入（如果已有資料且座標沒變的話，這裡簡單判斷是否有資料）
        if (venues.length > 0) return;

        let cancelled = false;

        const fetchVenues = async () => {
            setLoading(true);
            setError(false);
            try {
                const result = await searchFoursquareVenues(lat, lng, 800); // 擴大搜尋半徑至 800m
                if (!cancelled) {
                    if (result.apiUnavailable) {
                        setError(true);
                    } else {
                        setVenues(result.venues);
                    }
                }
            } catch (e) {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchVenues();

        return () => { cancelled = true; };
    }, [isExpanded, lat, lng]); // venues.length removed to allow refetch if coords change

    // 篩選邏輯
    const filteredVenues = venues.filter(venue => {
        if (activeFilter === 'ALL') return true;

        // 簡單的關鍵字分類映射
        const cats = venue.categories.map(c => c.name.toLowerCase()).join(' ');
        const emojis = venue.categories.map(c => c.emoji).join('');

        if (activeFilter === 'meal') {
            return cats.includes('restaurant') || cats.includes('sushi') || cats.includes('ramen') || cats.includes('steak') || emojis.includes('🍜') || emojis.includes('🍣') || emojis.includes('🥩');
        }
        if (activeFilter === 'cafe') {
            return cats.includes('coffee') || cats.includes('cafe') || cats.includes('bakery') || cats.includes('dessert') || emojis.includes('☕') || emojis.includes('🍰');
        }
        if (activeFilter === 'bar') {
            return cats.includes('bar') || cats.includes('izakaya') || cats.includes('pub') || emojis.includes('🍺') || emojis.includes('🍸');
        }
        return true;
    });

    if (!isExpanded) return null;

    if (loading) {
        return (
            <div className="py-8 flex flex-col items-center justify-center text-gray-400 space-y-2 animate-in fade-in">
                <Loader2 size={24} className="animate-spin text-primary-400" />
                <span className="text-xs">正在尋找附近美食 (Foursquare)...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-6 flex flex-col items-center justify-center text-gray-400 space-y-2 bg-gray-50 rounded-lg border border-gray-100 mx-1">
                <AlertCircle size={20} className="text-gray-300" />
                <span className="text-xs">無法載入 Foursquare 資料 (可能是 API Key 限制)</span>
                <span className="text-[10px] text-gray-300">請切換回 Google 來源</span>
            </div>
        );
    }

    if (venues.length === 0) {
        return (
            <div className="py-8 text-center text-gray-400 text-xs">
                附近沒有找到相關地點
            </div>
        );
    }

    return (
        <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Filter Chips */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar px-1">
                {FILTER_CHIPS.map(chip => (
                    <button
                        key={chip.value}
                        onClick={() => setActiveFilter(chip.value)}
                        className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all
              ${activeFilter === chip.value
                                ? 'bg-primary-500 text-white shadow-md scale-105'
                                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50 hover:border-gray-200'}
            `}
                    >
                        {chip.icon}
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* Venues List */}
            <div className="space-y-3">
                {filteredVenues.slice(0, 10).map((venue) => (
                    <div
                        key={venue.id}
                        className="group/venue bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md hover:border-primary-100 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden"
                        onMouseEnter={() => onHover?.({ lat: venue.location.lat, lng: venue.location.lng })}
                        onMouseLeave={() => onHover?.(null)}
                        onClick={() => window.open(`https://foursquare.com/v/${venue.id}`, '_blank')}
                    >
                        {/* Hover Highlight Line */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-400 opacity-0 group-hover/venue:opacity-100 transition-opacity" />

                        <div className="flex gap-3">
                            {/* Photo Thumbnail (if available) */}
                            {venue.photoUrl ? (
                                <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                                    <img src={venue.photoUrl} alt={venue.name} className="w-full h-full object-cover group-hover/venue:scale-110 transition-transform duration-500" />
                                </div>
                            ) : (
                                <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 border border-gray-100">
                                    <Utensils size={20} />
                                </div>
                            )}

                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                <div>
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-bold text-gray-800 text-sm truncate group-hover/venue:text-primary-600 transition-colors">
                                            {venue.name}
                                        </h4>
                                        {venue.rating && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getRatingColor(venue.rating)}`}>
                                                {venue.rating}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        <div className="flex items-center gap-0.5">
                                            {venue.categories.slice(0, 2).map((cat, i) => (
                                                <span key={i} title={cat.name}>{cat.emoji}</span>
                                            ))}
                                        </div>
                                        {venue.priceLevel && (
                                            <>
                                                <span className="text-gray-300">•</span>
                                                <span className="font-medium text-gray-600">{formatPriceLevel(venue.priceLevel)}</span>
                                            </>
                                        )}
                                        <span className="text-gray-300">•</span>
                                        <span className="truncate">{venue.distance}m</span>
                                    </div>
                                </div>

                                {/* Tips / Address */}
                                {venue.tips.length > 0 ? (
                                    <div className="mt-2 text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded line-clamp-1 italic">
                                        "{venue.tips[0]}"
                                    </div>
                                ) : (
                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 truncate">
                                        <MapPin size={10} />
                                        {venue.address}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredVenues.length === 0 && (
                    <div className="py-4 text-center text-gray-400 text-xs">
                        此分類下沒有結果
                    </div>
                )}
            </div>

            <div className="mt-3 text-center">
                <a
                    href="https://foursquare.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-gray-300 hover:text-gray-400 transition-colors inline-flex items-center gap-1"
                >
                    Powered by Foursquare
                    <ExternalLink size={8} />
                </a>
            </div>
        </div>
    );
};
