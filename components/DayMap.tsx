/**
 * DayMap.tsx - 互動式地圖元件
 * 
 * 功能：
 * - 使用 Leaflet 顯示互動式地圖
 * - 顯示行程中每個景點的標記
 * - 支援交通工具篩選（計程車、步行、火車等）
 * - 支援多種地圖樣式（標準、衛星、地形）
 * - 點擊標記可跳轉到對應的時間軸項目
 * - 支援高亮顯示特定位置（如附近餐廳）
 */

import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { ItineraryItem, TransportType } from '../types';
import { Filter, X, Star, Utensils, ExternalLink, MapPin, Crosshair, Navigation } from 'lucide-react';
import { TransportIcon, getTransportLabel } from './TransportIcon';
import { searchNearbyRestaurants, NearbyRestaurant, formatDistance, calculateDistance } from '../utils/places';
import { fetchRoute, formatDuration, formatRouteDistance, RouteResult } from '../utils/directions';
import { useI18n } from '../i18n';

// ======================================
// 型別定義
// ======================================

/**
 * DayMap 元件的 Props
 * @property items - 當日的行程項目陣列
 * @property activeItemId - 目前選中的項目 ID（用於高亮標記）
 * @property highlightedLocation - 要高亮的座標（如從餐廳列表 hover 時）
 */
interface DayMapProps {
  items: ItineraryItem[];
  activeItemId?: string | null;
  highlightedLocation?: { lat: number, lng: number } | null;
}

// ======================================
// 座標驗證工具
// ======================================

/**
 * 驗證座標是否有效
 */
const isValidCoordinate = (lat: any, lng: any): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * 檢測是否為手機裝置
 * 用於針對手機做效能優化
 */
const isMobileDevice = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
  );
};

// ======================================
// 地圖圖層設定
// ======================================

/**
 * 可用的地圖磚塊圖層
 * 使用者可以在地圖上切換不同的樣式
 */
const TILE_LAYERS = {
  /** 標準地圖 - CARTO Voyager（清晰、現代風格） */
  Standard: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  /** 衛星影像 - ESRI World Imagery */
  Satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  /** 地形圖 - OpenTopoMap */
  Terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
  }
};

/**
 * 渲染交通工具圖示（用於篩選選單）
 */
const renderTransportIcon = (type: TransportType) => <TransportIcon type={type} size={16} />;

/**
 * 建立餐廳標記並加到地圖上
 * @returns 建立的 marker 陣列
 */
const addRestaurantMarkersToMap = (
  map: L.Map,
  restaurants: { name: string; rating?: number; location?: { lat: number; lng: number } }[]
): L.Marker[] => {
  const markers: L.Marker[] = [];
  restaurants.forEach((restaurant) => {
    if (!restaurant.location) return;

    const restaurantIcon = L.divIcon({
      className: 'restaurant-marker-icon',
      html: `
        <div class="restaurant-pin">
          <span class="restaurant-name">${restaurant.name.slice(0, 8)}${restaurant.name.length > 8 ? '...' : ''}</span>
          ${restaurant.rating ? `<span class="restaurant-rating">★${restaurant.rating}</span>` : ''}
        </div>
      `,
      iconSize: [80, 40],
      iconAnchor: [40, 40],
    });

    const marker = L.marker(
      [restaurant.location.lat, restaurant.location.lng],
      { icon: restaurantIcon }
    ).addTo(map);

    markers.push(marker);
  });
  return markers;
};

// ======================================
// 主元件
// ======================================

/**
 * DayMap 互動式地圖元件
 * 
 * 使用方式：
 * ```tsx
 * <DayMap 
 *   items={dayItems} 
 *   activeItemId={selectedId}
 *   highlightedLocation={hoveredRestaurantLocation}
 * />
 * ```
 */
export const DayMap = React.memo<DayMapProps>(({ items, activeItemId, highlightedLocation }) => {
  const { t } = useI18n();
  // ====== Refs ======
  /** 地圖容器的 DOM 參考 */
  const mapContainerRef = useRef<HTMLDivElement>(null);
  /** Leaflet Map 實例的參考 */
  const mapInstanceRef = useRef<L.Map | null>(null);

  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const highlightMarkerRef = useRef<L.CircleMarker | null>(null);

  const [activeFilter, setActiveFilter] = useState<TransportType | 'ALL'>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // ====== 選中的項目（用於底部卡片顯示） ======
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);

  // ====== 附近餐廳（點擊 pin 後顯示） ======
  const [nearbyRestaurants, setNearbyRestaurants] = useState<NearbyRestaurant[]>([]);
  const restaurantMarkersRef = useRef<L.Marker[]>([]);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false);

  // ====== 載入狀態（用於顯示骨架動畫） ======
  const [isMapLoading, setIsMapLoading] = useState(true);

  // ====== 使用者定位 ======
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isShowingUserLocation, setIsShowingUserLocation] = useState(false);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  // ====== 路線軌跡圖層 ======
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map and Layer Controls
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const isMobile = isMobileDevice();

    // ====== 建立圖層（針對手機優化） ======
    const tileOptions = {
      attribution: TILE_LAYERS.Standard.attribution,
      updateWhenIdle: true,           // 只在停止移動時更新磚塊
      updateWhenZooming: false,       // 縮放時不更新
      keepBuffer: isMobile ? 1 : 2,   // 手機上減少快取（節省記憶體）
      maxZoom: 18,
      crossOrigin: true,
      // 手機上的額外優化
      ...(isMobile && {
        tileSize: 256,                // 使用標準大小
        zoomOffset: 0,
      })
    };

    const standardLayer = L.tileLayer(TILE_LAYERS.Standard.url, tileOptions);
    const satelliteLayer = L.tileLayer(TILE_LAYERS.Satellite.url, {
      ...tileOptions,
      attribution: TILE_LAYERS.Satellite.attribution
    });
    const terrainLayer = L.tileLayer(TILE_LAYERS.Terrain.url, {
      ...tileOptions,
      attribution: TILE_LAYERS.Terrain.attribution
    });

    // ====== 建立地圖實例（針對手機優化） ======
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      layers: [standardLayer],
      scrollWheelZoom: !isMobile,      // 手機上停用滾動縮放，避免卡住頁面
      // Remove preferCanvas to enable CSS animations on SVG paths
      // preferCanvas: true, 
      fadeAnimation: false,            // 關閉淡入動畫
      zoomAnimation: !isMobile,        // 手機上關閉縮放動畫
      markerZoomAnimation: !isMobile,  // 手機上關閉標記動畫
      // 手機觸控優化
      tap: isMobile,                   // 啟用觸控點擊
      tapTolerance: 15,                // 觸控容差
      touchZoom: true,
      bounceAtZoomLimits: false,       // 關閉縮放邊界彈跳

      // Remove explicit Canvas renderer
      // renderer: L.canvas({ padding: 0.5 }),
    }).setView([33.5902, 130.4017], 13);

    mapInstanceRef.current = map;

    // ====== 監聽磚塊載入完成 ======
    standardLayer.on('load', () => {
      setIsMapLoading(false);
    });

    // 2 秒後強制隱藏 loading（手機上縮短時間）
    setTimeout(() => setIsMapLoading(false), isMobile ? 2000 : 3000);

    // 縮放控制 (Move manually to adjust position if needed, but default is ok)
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 圖層切換控制
    const baseMaps = {
      "標準地圖": standardLayer,
      "衛星影像": satelliteLayer,
      "地形圖": terrainLayer
    };
    L.control.layers(baseMaps, undefined, { position: 'bottomright' }).addTo(map);

    // 延遲重算尺寸
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Markers rendering based on Items and Filter
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();

      // Clear existing route lines
      if (routeLayerRef.current) {
        routeLayerRef.current.clearLayers();
      } else {
        routeLayerRef.current = L.layerGroup().addTo(map);
      }

      // ====== 簡化的標記圖示（提升手機效能） ======
      const createCustomIcon = (index: number) => L.divIcon({
        className: 'custom-div-icon',
        // 簡化 HTML 結構，減少 DOM 元素
        html: `<div class="marker-pin">${index + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const validCoords: [number, number][] = [];

      // Draw Routes & Markers
      items.forEach((item, index) => {
        // Apply Filter
        if (activeFilter !== 'ALL' && item.transportType !== activeFilter) {
          return;
        }

        const { lat, lng } = item.coordinates || {};

        // Skip items with invalid coordinates
        if (!isValidCoordinate(lat, lng)) {
          console.warn(`Invalid coordinates for item: ${item.title}`, item.coordinates);
          return;
        }

        // Draw Line to Next Item (if exists and both valid)
        // 路線先用直線佔位，之後 async 嘗試 Mapbox 真實路線
        if (activeFilter === 'ALL' && index < items.length - 1) {
          const nextItem = items[index + 1];
          const nextCoords = nextItem.coordinates;

          if (nextCoords && isValidCoordinate(nextCoords.lat, nextCoords.lng)) {
            const isWalk = nextItem.transportType === TransportType.WALK;

            // 先畫直線（作為 fallback，之後如果有 Mapbox 路線會替換）
            const straightLine = L.polyline([[lat, lng], [nextCoords.lat, nextCoords.lng]], {
              color: isWalk ? '#6B7280' : '#4F46E5',
              weight: isWalk ? 4 : 5,
              opacity: isWalk ? 0.7 : 0.8,
              dashArray: isWalk ? '8, 12' : undefined,
              lineCap: 'round',
              className: isWalk ? 'animate-dash' : ''
            }).addTo(routeLayerRef.current!);

            // Calculate midpoint for transport icon
            const midLat = (lat + nextCoords.lat) / 2;
            const midLng = (lng + nextCoords.lng) / 2;

            // Improved SVG icons for transport visibility
            const getTransportIconHtml = (type: TransportType) => {
              const size = 18;
              const color = type === TransportType.WALK ? '#4B5563' : '#4338CA';
              const strokeWidth = 2.5;

              if (type === TransportType.WALK) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 11 3.8 11 8c0 1.25-.76 2.5-1.5 3.29C8.82 12 7.7 13.5 7 16" /><path d="M14 11c.88 0 2.29-.66 2.9-1.37C18.06 8.28 17.5 5 16.5 4" /><path d="M15.5 16.5 15 20" /><path d="M20 22c.5-1.5.5-2.5 0-3" /><path d="M8 22c.5-1.5.5-2.5 0-3" /></svg>`;
              if (type === TransportType.TRAIN) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="3" rx="2" /><path d="M6 3v1" /><path d="M18 3v1" /><path d="M8 11h8" /><path d="M8 15h8" /><path d="M9 19H6l-1 2" /><path d="M15 19h3l1 2" /></svg>`;
              if (type === TransportType.BUS) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6" /><path d="M15 6v6" /><path d="M2 12h19.6" /><path d="M18 18h3s.5-1.7.8-2.8c.1-.4-.2-.8-.6-.8h-2.4c-.4 0-.8.4-.9.8l-.4 2.8z" /><path d="M6 10V5c0-1.7 1.3-3 3-3h1" /><path d="M22 22H2" /></svg>`;
              return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>`;
            };

            const transportIcon = L.divIcon({
              className: 'transport-icon-marker',
              html: `<div class="bg-white p-1.5 rounded-full border-2 border-white shadow-md flex items-center justify-center hover:scale-110 transition-transform">${getTransportIconHtml(nextItem.transportType)}</div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });

            L.marker([midLat, midLng], {
              icon: transportIcon,
              interactive: false
            }).addTo(routeLayerRef.current!);

            // ====== 非同步嘗試 Mapbox 真實路線 ======
            // 在背景 fetch，成功後替換直線
            const segmentInfo = {
              startLat: lat, startLng: lng,
              endLat: nextCoords.lat, endLng: nextCoords.lng,
              transportType: nextItem.transportType,
              isWalk,
              straightLine,
              midLat, midLng
            };

            // 異步載入路線（不阻塞地圖渲染）
            (async () => {
              try {
                const route = await fetchRoute(
                  segmentInfo.startLat, segmentInfo.startLng,
                  segmentInfo.endLat, segmentInfo.endLng,
                  segmentInfo.transportType
                );

                if (route && routeLayerRef.current) {
                  // 移除直線，換成真實路線
                  segmentInfo.straightLine.remove();

                  L.polyline(route.geometry, {
                    color: segmentInfo.isWalk ? '#6B7280' : '#4F46E5',
                    weight: segmentInfo.isWalk ? 4 : 5,
                    opacity: segmentInfo.isWalk ? 0.85 : 0.9,
                    dashArray: segmentInfo.isWalk ? '8, 12' : undefined,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: segmentInfo.isWalk ? 'animate-dash' : ''
                  }).addTo(routeLayerRef.current);

                  // 在路線中點加上時間/距離標籤
                  const routeMid = route.geometry[Math.floor(route.geometry.length / 2)];
                  const badgeIcon = L.divIcon({
                    className: 'route-info-badge',
                    html: `<div class="bg-white/90 backdrop-blur-sm text-[10px] font-bold text-gray-600 px-1.5 py-0.5 rounded-full shadow-sm border border-gray-200 whitespace-nowrap">${formatDuration(route.duration)} · ${formatRouteDistance(route.distance)}</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                  });

                  L.marker(routeMid, { icon: badgeIcon, interactive: false })
                    .addTo(routeLayerRef.current);
                }
              } catch {
                // Mapbox 失敗，保留直線 fallback（不需處理）
              }
            })();
          }
        }

        try {
          const marker = L.marker([lat, lng], { icon: createCustomIcon(index) })
            .addTo(map);

          // 點擊標記時：顯示底部卡片 + 搜尋附近餐廳
          marker.on('click', async () => {
            // 設定選中的項目（觸發底部卡片顯示）
            setSelectedItem(item);
            setIsShowingUserLocation(false); // 關閉使用者位置模式

            // 清除之前的餐廳標記
            restaurantMarkersRef.current.forEach(m => m.remove());
            restaurantMarkersRef.current = [];
            setNearbyRestaurants([]);

            // 平移地圖讓標記在畫面中間偏上（給底部卡片留空間）
            const point = map.latLngToContainerPoint([lat, lng]);
            const newPoint = L.point(point.x, point.y + 80);
            const newLatLng = map.containerPointToLatLng(newPoint);
            map.panTo(newLatLng, { animate: true, duration: 0.3 });

            // 同時高亮時間軸上的項目（如果可見）
            const element = document.getElementById(`item-${item.id}`);
            if (element && element.offsetParent !== null) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.classList.add('ring-2', 'ring-primary-500', 'ring-offset-2');
              setTimeout(() => {
                element.classList.remove('ring-2', 'ring-primary-500', 'ring-offset-2');
              }, 2000);
            }

            // ====== 搜尋附近 500m 的餐廳 ======
            setIsLoadingRestaurants(true);
            try {
              const result = await searchNearbyRestaurants(lat, lng, 500);
              if (!result.apiUnavailable && result.restaurants.length > 0) {
                setNearbyRestaurants(result.restaurants.slice(0, 5)); // 最多顯示 5 間

                // 建立餐廳標記
                restaurantMarkersRef.current = addRestaurantMarkersToMap(map, result.restaurants.slice(0, 5));
              }
            } catch (err) {
              console.error('Failed to fetch nearby restaurants:', err);
            } finally {
              setIsLoadingRestaurants(false);
            }
          });

          markersRef.current.set(item.id, marker);
          validCoords.push([lat, lng]);
        } catch (markerError) {
          console.error('Error creating marker for item:', item.title, markerError);
        }
      });

      // Fit bounds to visible markers (only if we have valid coordinates)
      if (validCoords.length > 0) {
        try {
          const bounds = L.latLngBounds(validCoords);
          if (bounds.isValid()) {
            map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
          }
        } catch (boundsError) {
          console.error('Error fitting bounds:', boundsError);
        }
      }

      // Force resize calculation when items change (often implies view change)
      map.invalidateSize();
    } catch (error) {
      console.error('Error in marker rendering:', error);
    }
  }, [items, activeFilter]);

  // Handle Highlighted Location (e.g. from nearby restaurants)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing highlight marker
    if (highlightMarkerRef.current) {
      try {
        highlightMarkerRef.current.remove();
      } catch (e) {
        // Ignore removal errors
      }
      highlightMarkerRef.current = null;
    }

    if (highlightedLocation) {
      const { lat, lng } = highlightedLocation;

      // Validate coordinates before using with Leaflet
      if (!isValidCoordinate(lat, lng)) {
        console.warn('Invalid highlighted location coordinates:', highlightedLocation);
        return;
      }

      try {
        // Fly to location with high zoom
        map.flyTo([lat, lng], 17, {
          duration: 1.0,
          easeLinearity: 0.25
        });

        // Add a temporary highlight marker
        highlightMarkerRef.current = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: '#F97316', // Orange-500
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(map);
      } catch (error) {
        console.error('Error handling highlighted location:', error);
      }
    }
  }, [highlightedLocation]);

  // Handle User Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      userMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        fillColor: '#3B82F6', // Blue-500
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1
      }).addTo(map);

      // Add a halo effect
      const halo = L.circle([userLocation.lat, userLocation.lng], {
        radius: 20,
        color: '#3B82F6',
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.2
      }).addTo(map);

      // Cleanup halo when effect re-runs (simplified for now, ideally track halos too)
      return () => {
        halo.remove();
      };
    }
  }, [userLocation]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('您的瀏覽器不支援定位功能');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coords = { lat: latitude, lng: longitude };

        setUserLocation(coords);
        setIsLocating(false);
        setIsShowingUserLocation(true);
        setSelectedItem(null); // 清除選中的行程項目

        // Pan to user location
        mapInstanceRef.current?.flyTo([latitude, longitude], 16, {
          duration: 1.5
        });

        // ====== 搜尋附近餐廳 ======
        setIsLoadingRestaurants(true);
        // 清除舊標記
        restaurantMarkersRef.current.forEach(m => m.remove());
        restaurantMarkersRef.current = [];
        setNearbyRestaurants([]);

        try {
          const result = await searchNearbyRestaurants(latitude, longitude, 500);
          if (!result.apiUnavailable && result.restaurants.length > 0) {
            setNearbyRestaurants(result.restaurants.slice(0, 10)); // 顯示更多附近餐廳

            const map = mapInstanceRef.current;
            if (map) {
              restaurantMarkersRef.current = addRestaurantMarkersToMap(map, result.restaurants.slice(0, 10));
            }
          }
        } catch (err) {
          console.error('Failed to fetch nearby restaurants for user location:', err);
        } finally {
          setIsLoadingRestaurants(false);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsLocating(false);
        // Handle specific error codes if needed
        let msg = '無法取得您的位置';
        if (error.code === 1) msg = '請允許瀏覽器存取您的位置';
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Handle External Highlight (Hover from Timeline)
  useEffect(() => {
    if (!activeItemId) {
      mapInstanceRef.current?.closePopup();
      return;
    }

    const marker = markersRef.current.get(activeItemId);
    // Only open popup if the marker is actually visible (not filtered out)
    if (marker) {
      marker.openPopup();
      // On mobile map view, we might want to pan to it
      mapInstanceRef.current?.panTo(marker.getLatLng());
    }
  }, [activeItemId]);

  return (
    <div className="w-full h-full relative z-0">
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-dash {
          animation: dash 1s linear infinite;
        }
        
        /* 簡化的標記樣式（效能優化） */
        .marker-pin {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        /* 餐廳標記樣式 */
        .restaurant-marker-icon {
          background: transparent;
        }
        .restaurant-pin {
          background: white;
          border: 1px solid #F97316;
          border-radius: 8px;
          padding: 4px 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          white-space: nowrap;
          transform: translateY(-100%);
          position: relative;
          max-width: 160px; /* Constrain width */
        }
        .restaurant-pin::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #F97316;
        }
        .restaurant-name {
          font-weight: bold;
          color: #C2410C;
          font-size: 11px;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis; /* Truncate long names */
          text-align: center;
        }
        .restaurant-rating {
          font-size: 9px;
          color: #F59E0B;
        }

        /* Fix Z-index for mobile controls */
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
        }
        .leaflet-control-zoom a {
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
        }
      `}</style>

      {/* 地圖容器 */}
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-3xl overflow-hidden shadow-inner bg-slate-50 relative z-0"
      />
      {/* ====== Loading 骨架動畫 ====== */}
      {isMapLoading && (
        <div className="absolute inset-0 bg-slate-100 z-[500] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            {/* 脈動圓圈動畫 */}
            <div className="relative">
              <div className="w-12 h-12 border-4 border-primary-200 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-primary-500 rounded-full animate-spin"></div>
            </div>
            <span className="text-sm font-medium text-slate-500">載入地圖中...</span>
          </div>
        </div>
      )}

      {/* Custom Filter UI Overlay */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col items-start gap-2">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`p-2.5 rounded-lg shadow-md transition-all flex items-center gap-2 ${isFilterOpen ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {isFilterOpen ? <X size={20} /> : <Filter size={20} />}
          <span className="text-sm font-bold hidden md:block">
            {activeFilter === 'ALL' ? t('mapFilter') : getTransportLabel(activeFilter, t)}
          </span>
        </button>

        {isFilterOpen && (
          <div className="bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-xl border border-gray-100 flex flex-col gap-1 w-40 animate-in fade-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => { setActiveFilter('ALL'); setIsFilterOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${activeFilter === 'ALL' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <span>{t('mapAllItems')}</span>
              {activeFilter === 'ALL' && <div className="w-2 h-2 bg-primary-500 rounded-full"></div>}
            </button>
            <hr className="border-gray-100 my-1" />
            {Object.values(TransportType).map((type) => (
              <button
                key={type}
                onClick={() => { setActiveFilter(type); setIsFilterOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${activeFilter === type ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {renderTransportIcon(type)}
                {getTransportLabel(type, t)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 定位按鈕 */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={handleLocateMe}
          className={`p-2.5 rounded-full shadow-md transition-all flex items-center justify-center ${isLocating
            ? 'bg-primary-50 text-primary-600 animate-pulse'
            : userLocation
              ? 'bg-white text-blue-500 hover:bg-gray-50'
              : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          title="定位我的位置"
        >
          <Crosshair size={20} className={isLocating ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ====== 底部卡片（取代 popup） ====== */}
      {(selectedItem || isShowingUserLocation) && (
        <div
          // Modified bottom position to avoid overlap with bottom navigation on mobile
          // md:bottom-4 resets it for desktop
          className="absolute bottom-24 md:bottom-4 left-4 right-4 z-[1000] animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-4 relative">
            {/* 關閉按鈕 */}
            <button
              onClick={() => {
                setSelectedItem(null);
                setIsShowingUserLocation(false);
                // 清除餐廳標記
                restaurantMarkersRef.current.forEach(m => m.remove());
                restaurantMarkersRef.current = [];
                setNearbyRestaurants([]);
              }}
              // Increased touch target size
              className="absolute top-2 right-2 p-2 rounded-full bg-gray-100/80 hover:bg-gray-200 backdrop-blur-sm transition-colors z-10"
              aria-label="關閉卡片"
            >
              <X size={16} className="text-gray-600" />
            </button>

            {/* 卡片內容 */}
            <div className="flex items-start gap-3 pr-6">
              {/* 時間標籤 / 位置圖示 */}
              <div className="flex-shrink-0">
                {isShowingUserLocation ? (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Navigation size={16} className="fill-blue-600" />
                  </div>
                ) : (
                  <div className="inline-block px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-bold border border-primary-100">
                    {selectedItem?.time}
                  </div>
                )}
              </div>

              {/* 資訊區 */}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-800 text-sm mb-1 truncate">
                  {isShowingUserLocation ? '你的目前位置' : selectedItem?.title}
                </h4>
                <p className="text-xs text-gray-500 line-clamp-1">
                  {isShowingUserLocation ? '正在搜尋附近的餐廳...' : selectedItem?.address_jp}
                </p>
                {/* 距離資訊 - 只在選中景點時顯示 */}
                {!isShowingUserLocation && userLocation && selectedItem?.coordinates && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1 font-medium">
                    <Navigation size={10} />
                    距離你 {formatDistance(calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      selectedItem.coordinates.lat,
                      selectedItem.coordinates.lng
                    ))}
                  </p>
                )}
              </div>
            </div>

            {/* 附近餐廳列表 */}
            {isLoadingRestaurants && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-orange-500 flex items-center gap-1">
                  <Utensils size={10} className="animate-pulse" />
                  搜尋附近餐廳...
                </p>
              </div>
            )}

            {!isLoadingRestaurants && nearbyRestaurants.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Utensils size={10} />
                  附近 {nearbyRestaurants.length} 間餐廳
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {nearbyRestaurants.map((restaurant) => (
                    <a
                      key={restaurant.placeId}
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name + ' ' + (restaurant.address || ''))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-gray-800 truncate">
                            {restaurant.name}
                          </span>
                          {restaurant.rating && (
                            <span className="flex items-center gap-0.5 text-xs text-orange-600 flex-shrink-0">
                              <Star size={10} fill="currentColor" />
                              {restaurant.rating}
                            </span>
                          )}
                          {/* 營業狀態標籤 */}
                          {restaurant.isOpen !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${restaurant.isOpen
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                              }`}>
                              {restaurant.isOpen ? '營業中' : '休息中'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {restaurant.distance && (
                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                              <MapPin size={8} />
                              {formatDistance(restaurant.distance)}
                            </span>
                          )}
                          {/* 當天營業時間 */}
                          {restaurant.todayHours && (
                            <span className="text-[10px] text-gray-400">
                              今日 {restaurant.todayHours}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-gray-400 group-hover:text-orange-500 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}


    </div >
  );
});
