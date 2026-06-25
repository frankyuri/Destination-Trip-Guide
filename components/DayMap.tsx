import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { Filter, X } from 'lucide-react';
import { ItineraryItem, TransportType } from '../types';
import { getTransportLabel, TransportIcon } from './TransportIcon';

interface DayMapProps {
  items: ItineraryItem[];
  activeItemId?: string | null;
}

const TILE_LAYERS = {
  Standard: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  Satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri and contributors',
  },
  Terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data &copy; OpenStreetMap contributors | Map style &copy; OpenTopoMap',
  },
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);

export const DayMap: React.FC<DayMapProps> = ({ items, activeItemId }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const resizeTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<TransportType | 'ALL'>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const standardLayer = L.tileLayer(TILE_LAYERS.Standard.url, TILE_LAYERS.Standard);
    const satelliteLayer = L.tileLayer(TILE_LAYERS.Satellite.url, TILE_LAYERS.Satellite);
    const terrainLayer = L.tileLayer(TILE_LAYERS.Terrain.url, TILE_LAYERS.Terrain);
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      layers: [standardLayer],
    }).setView([33.5902, 130.4017], 13);

    mapInstanceRef.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.layers(
      { '標準地圖': standardLayer, '衛星影像': satelliteLayer, '地形圖': terrainLayer },
      undefined,
      { position: 'bottomright' },
    ).addTo(map);

    resizeTimerRef.current = window.setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    const bounds = L.latLngBounds([]);
    let visibleMarkerCount = 0;

    items.forEach((item, index) => {
      if (activeFilter !== 'ALL' && item.transportType !== activeFilter) return;
      const { lat, lng } = item.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn(`Invalid coordinates for item: ${item.title}`);
        return;
      }

      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-marker-pin"></div><div style="position:absolute;top:-45px;left:-35px;width:100px;text-align:center;font-weight:bold;color:#4338CA;text-shadow:0 1px 2px white;pointer-events:none">${index + 1}</div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -35],
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div class="font-sans w-48 p-1"><span class="inline-block rounded border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">${escapeHtml(item.time)}</span><h3 class="mb-2 mt-2 text-sm font-bold leading-snug text-slate-800">${escapeHtml(item.title)}</h3><p class="border-t border-slate-100 pt-2 text-[10px] leading-relaxed text-slate-500">${escapeHtml(item.address_jp)}</p></div>`,
          { closeButton: false, className: 'custom-popup', minWidth: 200 },
        );

      marker.on('click', () => {
        const element = document.getElementById(`item-${item.id}`);
        if (!element || element.offsetParent === null) return;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary-500', 'ring-offset-2');
        if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary-500', 'ring-offset-2');
        }, 2000);
      });

      markersRef.current.set(item.id, marker);
      bounds.extend([lat, lng]);
      visibleMarkerCount += 1;
    });

    if (visibleMarkerCount > 0 && bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1 });
    }
    map.invalidateSize();
  }, [items, activeFilter]);

  useEffect(() => {
    if (!activeItemId) {
      mapInstanceRef.current?.closePopup();
      return;
    }
    const marker = markersRef.current.get(activeItemId);
    if (marker) {
      marker.openPopup();
      mapInstanceRef.current?.panTo(marker.getLatLng());
    }
  }, [activeItemId]);

  return (
    <section className="group relative z-0 h-full w-full overflow-hidden rounded-2xl border border-white/50 shadow-card" aria-label="每日行程地圖">
      <div ref={mapContainerRef} className="h-full w-full bg-slate-100" />
      <div className="absolute left-4 top-4 z-[1000] flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setIsFilterOpen((open) => !open)}
          className={`flex min-h-11 items-center gap-2 rounded-lg p-2.5 shadow-md transition-all ${isFilterOpen ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          aria-expanded={isFilterOpen}
          aria-controls="transport-filter-menu"
        >
          {isFilterOpen ? <X size={20} aria-hidden="true" /> : <Filter size={20} aria-hidden="true" />}
          <span className="hidden text-sm font-bold md:block">{activeFilter === 'ALL' ? '交通篩選' : getTransportLabel(activeFilter)}</span>
          <span className="sr-only">交通篩選</span>
        </button>

        {isFilterOpen && (
          <div id="transport-filter-menu" className="flex w-40 flex-col gap-1 rounded-xl border border-gray-100 bg-white/95 p-2 shadow-xl backdrop-blur-sm">
            <button
              type="button"
              onClick={() => { setActiveFilter('ALL'); setIsFilterOpen(false); }}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${activeFilter === 'ALL' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
              aria-pressed={activeFilter === 'ALL'}
            >
              <span>全部顯示</span>
              {activeFilter === 'ALL' && <span className="h-2 w-2 rounded-full bg-primary-500" aria-hidden="true" />}
            </button>
            <hr className="my-1 border-gray-100" />
            {Object.values(TransportType).map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => { setActiveFilter(type); setIsFilterOpen(false); }}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${activeFilter === type ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
                aria-pressed={activeFilter === type}
              >
                <TransportIcon type={type} size={16} />
                {getTransportLabel(type)}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};