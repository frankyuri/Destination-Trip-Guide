import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { ItineraryItem } from './types';
// import { ITINERARY_DATA } from './constants'; // Replaced by hook
import { TimelineItem } from './components/TimelineItem';
import { Footer } from './components/Footer';
import { WeatherWidget } from './components/WeatherWidget';
import { ShareButton } from './components/ShareButton';
import { useProgressTracker, DayProgressBar } from './components/ProgressTracker';
// Lazy load heavy components for code splitting
const CountdownWidget = lazy(() => import('./components/CountdownWidget').then(m => ({ default: m.CountdownWidget })));
const EmergencyInfo = lazy(() => import('./components/EmergencyInfo').then(m => ({ default: m.EmergencyInfo })));
import { Plane, Map as MapIcon, List, Loader2, Globe } from 'lucide-react';

// Lazy load heavy components for code splitting
const DayMap = lazy(() => import('./components/DayMap').then(m => ({ default: m.DayMap })));
const CurrencyWidget = lazy(() => import('./components/CurrencyWidget').then(m => ({ default: m.CurrencyWidget })));

// Loading fallback component
const MapLoadingFallback = () => (
  <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center">
    <div className="flex flex-col items-center gap-2 text-slate-400">
      <Loader2 className="animate-spin" size={32} />
      <span className="text-sm font-medium">載入地圖中...</span>
    </div>
  </div>
);

const WidgetLoadingFallback = () => (
  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm animate-pulse">
    <div className="h-24 bg-gray-100 rounded"></div>
  </div>
);

import { useItinerary } from './hooks/useItinerary';
import { Pencil, Save, RotateCcw, Plus, X, Download, Upload } from 'lucide-react';
import { useI18n, LOCALE_LABELS, Locale } from './i18n';
import { exportItineraryJSON, importItineraryJSON, exportAllICS } from './utils/exportImport';

const App: React.FC = () => {
  // Use custom hook for DB data
  const { itinerary, loading, isEditing, setIsEditing, updateItem, addItem, deleteItem, addDay, resetToDefault, activePlan, switchPlan, importItinerary } = useItinerary();
  const { t, locale, setLocale } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle JSON import
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(t('confirmImportOverwrite'))) {
      e.target.value = '';
      return;
    }

    const result = await importItineraryJSON(file);
    if (result.success) {
      await importItinerary(result.data);
      setDbError(null);
      // Show success toast briefly
      setSuccessToast(t('importSuccess'));
      setTimeout(() => setSuccessToast(null), 3000);
    } else {
      setDbError(t('importError'));
    }
    e.target.value = '';
  }, [t, importItinerary]);

  // Read initial day from URL for share link support
  // ... (keep logic but use itinerary data)
  const getInitialDayIndex = () => {
    const params = new URLSearchParams(window.location.search);
    const dayParam = params.get('day');
    if (dayParam) {
      const index = parseInt(dayParam, 10);
      // Check against loaded itinerary length later
      // For basic init, we default to 0. 
      // Safe to verify index validity in effect or render.
      return index;
    }
    return 0;
  };

  const [activeDayIndex, setActiveDayIndex] = useState(getInitialDayIndex);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [highlightedLocation, setHighlightedLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'list' | 'map'>('list');
  const [dbError, setDbError] = useState<string | null>(null);

  // Detect mobile viewport for conditional rendering (unmount DayMap in list mode)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for DB error events dispatched from db.ts
  useEffect(() => {
    const handleDbError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setDbError(detail?.message || '資料庫操作失敗');
      // Auto-dismiss after 5 seconds
      setTimeout(() => setDbError(null), 5000);
    };
    window.addEventListener('db-error', handleDbError);
    return () => window.removeEventListener('db-error', handleDbError);
  }, []);

  const [prevItineraryLength, setPrevItineraryLength] = useState(0);

  // Validate activeDayIndex when data loads
  useEffect(() => {
    if (!loading) {
      // If items added (length increased), switch to last one
      if (itinerary.length > prevItineraryLength && prevItineraryLength > 0) {
        setActiveDayIndex(itinerary.length - 1);
      }
      // Safety check: if active index out of bounds (e.g. deletion), reset
      else if (activeDayIndex >= itinerary.length) {
        setActiveDayIndex(0);
      }
      setPrevItineraryLength(itinerary.length);
    }
  }, [loading, itinerary, activeDayIndex, prevItineraryLength]);

  // Update URL ... (Keep existing)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('day', activeDayIndex.toString());
    window.history.replaceState({}, '', url.toString());
  }, [activeDayIndex]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileViewMode('list');
  }, [activeDayIndex]);



  const activeDay = itinerary[activeDayIndex] || itinerary[0]; // Fallback while loading
  const activeDayDate = activeDay?.date; // Stable ref for callbacks

  // Progress tracking
  const { toggleItem, isCompleted, getProgress } = useProgressTracker();

  // Stable Handlers for TimelineItem
  const handleItemUpdate = useCallback((newItem: ItineraryItem) => {
    if (activeDayDate) {
      updateItem(activeDayDate, newItem);
    }
  }, [activeDayDate, updateItem]);

  const handleItemDelete = useCallback((itemId: string) => {
    if (activeDayDate) {
      deleteItem(activeDayDate, itemId);
    }
  }, [activeDayDate, deleteItem]);

  const handleItemToggle = useCallback((itemId: string) => {
    toggleItem(itemId);
  }, [toggleItem]);

  // Safe check for items presence
  const dayProgress = activeDay?.items
    ? getProgress(activeDay.items.map(item => item.id))
    : { completed: 0, total: 0 };

  if (loading || !activeDay) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary-500" size={40} />
          <p className="text-slate-500 font-medium">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-surface-50 text-slate-800 pb-20 md:pb-12">

      {/* Immersive Hero Header */}
      <header className="relative bg-gradient-to-br from-primary-800 via-primary-900 to-sakura-500/30 text-white overflow-hidden pb-8 md:pb-12 rounded-b-[32px] md:rounded-b-[40px] shadow-2xl z-20">
        {/* ... Background Shapes ... */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-sakura-400 rounded-full blur-[80px] md:blur-[100px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-sunset-coral rounded-full blur-[80px] md:blur-[100px] animate-pulse-slow"></div>
          <div className="absolute top-[30%] right-[20%] w-[100px] h-[100px] md:w-[200px] md:h-[200px] bg-primary-400 rounded-full blur-[60px] md:blur-[80px]"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pt-14 md:pt-20 text-center">

          {/* Top Controls: Edit Mode & Reset — responsive row */}
          <div className="absolute top-3 md:top-6 right-3 md:right-6 left-3 md:left-auto flex items-center justify-end gap-1.5 md:gap-2 flex-wrap z-30">
            {/* Export / Import buttons (visible in edit mode) — inline with other controls */}
            {isEditing && (
              <>
                <button
                  onClick={() => exportItineraryJSON(itinerary, activePlan)}
                  className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/30 text-[10px] font-bold text-white hover:bg-white/20 transition-all"
                >
                  <Download size={10} /> JSON
                </button>
                <button
                  onClick={() => exportAllICS(itinerary)}
                  className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/30 text-[10px] font-bold text-white hover:bg-white/20 transition-all"
                >
                  <Download size={10} /> ICS
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/30 text-[10px] font-bold text-white hover:bg-white/20 transition-all"
                >
                  <Upload size={10} /> {t('importJSON')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                <div className="hidden md:block w-[1px] h-5 bg-white/20" />
              </>
            )}

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/30 text-[10px] md:text-xs font-bold text-white hover:bg-white/20 transition-all"
              >
                <Globe size={12} />
                {LOCALE_LABELS[locale]}
              </button>
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 min-w-[120px]">
                    {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setLocale(key); setShowLangMenu(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${locale === key ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {isEditing && (
              <button
                onClick={resetToDefault}
                className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-red-500/20 backdrop-blur-md border border-red-400/30 text-[10px] md:text-xs font-bold text-white hover:bg-red-500/40 transition-all"
              >
                <RotateCcw size={12} /> {t('resetDefault')}
              </button>
            )}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1 md:px-4 md:py-1.5 rounded-full backdrop-blur-md border border-white/30 text-[10px] md:text-xs font-bold transition-all shadow-lg ${isEditing
                ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300'
                : 'bg-white/10 text-white hover:bg-white/20'
                }`}
            >
              {isEditing ? <Save size={14} /> : <Pencil size={14} />}
              {isEditing ? t('exitEdit') : t('editMode')}
            </button>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/30 text-[10px] md:text-xs font-bold tracking-widest uppercase mb-4 md:mb-6 shadow-glow-pink">
            <Plane size={12} className="text-sakura-300" /> 2025 Fukuoka Trip
          </div>

          <h1 className="text-3xl md:text-6xl font-black mb-3 md:mb-4 leading-tight tracking-tight">
            {t('appTitle')}
          </h1>
          <p className="text-white/80 max-w-lg mx-auto text-xs md:text-lg font-light mb-4 px-4 leading-relaxed">
            {t('appSubtitle')}
          </p>

          {/* Plan Switcher */}
          <div className="flex justify-center gap-2 mb-6 md:mb-8">
            <button
              onClick={() => switchPlan('plan1')}
              className={`px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${activePlan === 'plan1'
                ? 'bg-white text-primary-900 shadow-lg scale-105'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20'
                }`}
            >
              {t('plan1')}
            </button>
            <button
              onClick={() => switchPlan('plan2')}
              className={`px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${activePlan === 'plan2'
                ? 'bg-white text-primary-900 shadow-lg scale-105'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20'
                }`}
            >
              {t('plan2')}
            </button>
          </div>
        </div>

        {/* Day Selector */}
        <div className="relative z-20 px-4 max-w-5xl mx-auto mt-2 md:mt-4">
          <div className="flex gap-3 md:justify-center overflow-x-auto no-scrollbar pb-2 px-2 snap-x snap-mandatory">
            {itinerary.map((day, index) => {
              const isActive = activeDayIndex === index;
              return (
                <button
                  key={day.dayTitle}
                  onClick={() => setActiveDayIndex(index)}
                  className={`snap-center flex-shrink-0 group relative flex flex-col items-start justify-center p-3 md:p-4 min-w-[100px] md:min-w-[120px] rounded-2xl border transition-all duration-300 ${isActive
                    ? 'bg-white text-primary-900 shadow-float scale-105 border-sakura-200'
                    : 'bg-white/10 text-white border-white/10 hover:bg-white/20 hover:border-white/30'
                    }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-sakura-500' : 'text-sakura-200'}`}>
                    {day.date}
                  </span>
                  <span className={`text-lg md:text-xl font-bold ${isActive ? 'text-primary-800' : 'text-white'}`}>
                    {day.dayTitle}
                  </span>
                  {isActive && (
                    <div className="absolute top-3 right-3 w-2 h-2 bg-gradient-to-r from-sakura-400 to-sunset-coral rounded-full animate-pulse shadow-glow-pink"></div>
                  )}
                </button>
              );
            })}

            {/* Add Day Button */}
            {isEditing && (
              <button
                onClick={addDay}
                className="snap-center flex-shrink-0 flex items-center justify-center p-3 md:p-4 min-w-[60px] md:min-w-[80px] rounded-2xl border border-white/20 bg-white/5 hover:bg-white/20 text-white/60 hover:text-white transition-all group"
                title={t('addDay')}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={20} />
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 mt-6 md:mt-12">

        {/* Day Context Title & Weather */}
        <div className="mb-6 md:mb-8 flex flex-col items-center justify-center relative gap-4 md:gap-6">
          <div className="text-center px-2">
            <h2 className="text-xl md:text-3xl font-bold text-slate-800 flex flex-wrap items-center justify-center gap-2 md:gap-3 leading-snug">
              <span className="hidden md:block w-8 h-1 bg-gradient-to-r from-primary-500 to-primary-300 rounded-full"></span>
              {activeDay.theme}
              <span className="hidden md:block w-8 h-1 bg-gradient-to-l from-primary-500 to-primary-300 rounded-full"></span>
            </h2>
            <p className="mt-2 md:mt-3 text-xs md:text-base text-slate-500 font-medium bg-white inline-block px-3 py-1.5 rounded-full shadow-sm border border-slate-100 max-w-full truncate">
              {activeDay.focus}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <WeatherWidget date={activeDay.date} />
            <ShareButton dayIndex={activeDayIndex} dayTitle={activeDay.dayTitle} />
          </div>

          <div className="w-full max-w-md">
            <DayProgressBar
              completed={dayProgress.completed}
              total={dayProgress.total}
            />
          </div>
        </div>

        {/* Countdown & Emergency Info */}
        {activeDayIndex === 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Suspense fallback={<WidgetLoadingFallback />}>
              <CountdownWidget tripStartDate={itinerary[0].date} />
            </Suspense>
            <Suspense fallback={<WidgetLoadingFallback />}>
              <EmergencyInfo />
            </Suspense>
          </div>
        )}

        {/* Split View Container */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative">

          {/* Left: Timeline */}
          <div className={`order-2 lg:order-1 lg:w-3/5 ${mobileViewMode === 'map' ? 'hidden lg:block' : 'block'}`}>
            <div className="relative md:px-4">
              {activeDay.items.map((item, index) => (
                <TimelineItem
                  key={item.id}
                  item={item}
                  isLast={index === activeDay.items.length - 1}
                  dayDate={activeDay.date}
                  isActive={activeItemId === item.id}
                  onActive={setActiveItemId}
                  onRestaurantHover={setHighlightedLocation}
                  isCompleted={isCompleted(item.id)}
                  onToggleComplete={handleItemToggle}
                  index={index}
                  isEditing={isEditing}
                  onUpdate={handleItemUpdate}
                  onDelete={handleItemDelete}
                />
              ))}

              {isEditing && (
                <button
                  onClick={() => addItem(activeDay.date)}
                  className="w-full py-4 mt-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-bold flex items-center justify-center gap-2 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50 transition-all"
                >
                  <Plus size={20} />
                  {t('addItem')}
                </button>
              )}
            </div>

            <div className="mt-8 px-4">
              <Suspense fallback={<WidgetLoadingFallback />}>
                <CurrencyWidget />
              </Suspense>
            </div>

            <Footer />
          </div>

          {/* Right: Map — conditionally unmount on mobile list mode to save resources */}
          {(!isMobile || mobileViewMode === 'map') && (
            <div className={`order-1 lg:order-2 lg:w-2/5 block`}>

              {/* Desktop Layout: Sticky Sidebar */}
              <div className={`
              flex flex-col gap-4
              ${mobileViewMode === 'map'
                  ? 'h-[85vh] w-full'
                  : 'lg:sticky lg:top-8 lg:h-[calc(100vh-60px)]'}
            `}>

                {/* Map Container */}
                <div className="flex-grow w-full rounded-3xl shadow-float overflow-hidden relative min-h-[300px]">
                  <Suspense fallback={<MapLoadingFallback />}>
                    <DayMap
                      items={activeDay.items}
                      activeItemId={activeItemId}
                      highlightedLocation={highlightedLocation}
                    />
                  </Suspense>
                </div>

                {mobileViewMode === 'map' && (
                  <p className="text-center text-xs text-slate-400 lg:hidden">
                    點擊地標查看詳情，或切換回列表模式瀏覽行程
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Mobile Floating Action Button (FAB) */}
      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 w-full z-50 bg-white/90 backdrop-blur-lg border-t border-gray-200 pb-safe lg:hidden transition-transform duration-300">
        <div className="flex items-center justify-around p-2">
          <button
            onClick={() => setMobileViewMode('list')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl w-24 transition-all ${mobileViewMode === 'list'
              ? 'text-primary-600 bg-primary-50'
              : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <List size={22} strokeWidth={mobileViewMode === 'list' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">{t('listView')}</span>
          </button>

          <div className="w-[1px] h-8 bg-gray-100"></div>

          <button
            onClick={() => setMobileViewMode('map')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl w-24 transition-all ${mobileViewMode === 'map'
              ? 'text-primary-600 bg-primary-50'
              : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <MapIcon size={22} strokeWidth={mobileViewMode === 'map' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">{t('mapView')}</span>
          </button>
        </div>
      </div>


      {/* DB Error Toast */}
      {dbError && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm">
          <span className="text-sm font-medium">{dbError}</span>
          <button
            onClick={() => setDbError(null)}
            className="text-red-200 hover:text-white transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-300">
          {successToast}
        </div>
      )}

    </div>
  );
};

export default App;