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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-ink-700" size={28} strokeWidth={1.5} />
          <p className="text-ink-500 text-sm tracking-wide">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-white text-ink-900 pb-20 md:pb-12">

      {/* Minimal Ink Header — sumi-e inspired */}
      <header className="relative bg-white border-b border-ink-100 z-20">
        {/* Vertical Japanese accent — decorative, hidden on mobile */}
        <div
          aria-hidden
          className="hidden md:block absolute top-8 right-8 text-ink-100 font-serif text-[120px] leading-none select-none pointer-events-none"
          style={{ writingMode: 'vertical-rl' }}
        >
          福岡
        </div>

        <div className="relative max-w-5xl mx-auto px-5 md:px-8 pt-6 md:pt-10 pb-6 md:pb-10">

          {/* Top Controls */}
          <div className="flex items-center justify-end gap-1.5 flex-wrap mb-8 md:mb-12">
            {isEditing && (
              <>
                <button
                  onClick={() => exportItineraryJSON(itinerary, activePlan)}
                  className="flex items-center gap-1 px-2.5 py-1 border border-ink-200 text-[10px] font-medium text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors"
                >
                  <Download size={10} /> JSON
                </button>
                <button
                  onClick={() => exportAllICS(itinerary)}
                  className="flex items-center gap-1 px-2.5 py-1 border border-ink-200 text-[10px] font-medium text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors"
                >
                  <Download size={10} /> ICS
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 border border-ink-200 text-[10px] font-medium text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors"
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
              </>
            )}

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1 border border-ink-200 text-[11px] font-medium text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors"
              >
                <Globe size={12} />
                {LOCALE_LABELS[locale]}
              </button>
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-ink-200 py-1 z-50 min-w-[120px] shadow-sm">
                    {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setLocale(key); setShowLangMenu(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${locale === key ? 'bg-ink-50 text-ink-900 font-semibold' : 'text-ink-700 hover:bg-ink-50'
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
                className="flex items-center gap-1 px-2.5 py-1 border border-vermillion text-[11px] font-medium text-vermillion hover:bg-vermillion hover:text-white transition-colors"
              >
                <RotateCcw size={12} /> {t('resetDefault')}
              </button>
            )}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium transition-colors border ${isEditing
                ? 'bg-ink-900 border-ink-900 text-white hover:bg-ink-700'
                : 'border-ink-200 text-ink-700 hover:border-ink-900 hover:text-ink-900'
                }`}
            >
              {isEditing ? <Save size={12} /> : <Pencil size={12} />}
              {isEditing ? t('exitEdit') : t('editMode')}
            </button>
          </div>

          {/* Title block — asymmetric editorial */}
          <div className="flex items-start gap-3 mb-2">
            <span className="block w-10 h-[2px] bg-vermillion mt-4 md:mt-6 flex-shrink-0" aria-hidden />
            <div>
              <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-medium tracking-[0.25em] uppercase text-ink-500 mb-3">
                <Plane size={11} /> 2025 · Fukuoka · 4 Days
              </div>
              <h1 className="font-serif text-4xl md:text-7xl font-bold text-ink-900 leading-[1.05] tracking-tight">
                {t('appTitle')}
              </h1>
            </div>
          </div>

          <p className="mt-5 md:mt-6 max-w-xl text-ink-500 text-sm md:text-base leading-relaxed pl-[3.25rem]">
            {t('appSubtitle')}
          </p>

          {/* Plan Switcher — text tabs with underline */}
          <div className="flex gap-6 mt-8 md:mt-10 pl-[3.25rem] border-b border-ink-100">
            <button
              onClick={() => switchPlan('plan1')}
              className={`pb-3 text-xs md:text-sm font-medium tracking-wide transition-colors relative ${activePlan === 'plan1'
                ? 'text-ink-900'
                : 'text-ink-300 hover:text-ink-700'
                }`}
            >
              {t('plan1')}
              {activePlan === 'plan1' && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-ink-900" />}
            </button>
            <button
              onClick={() => switchPlan('plan2')}
              className={`pb-3 text-xs md:text-sm font-medium tracking-wide transition-colors relative ${activePlan === 'plan2'
                ? 'text-ink-900'
                : 'text-ink-300 hover:text-ink-700'
                }`}
            >
              {t('plan2')}
              {activePlan === 'plan2' && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-ink-900" />}
            </button>
          </div>
        </div>

        {/* Day Selector — numbered editorial cards */}
        <div className="relative max-w-5xl mx-auto px-5 md:px-8 pb-6 md:pb-8">
          <div className="flex gap-0 overflow-x-auto no-scrollbar snap-x snap-mandatory border-t border-ink-100">
            {itinerary.map((day, index) => {
              const isActive = activeDayIndex === index;
              return (
                <button
                  key={day.dayTitle}
                  onClick={() => setActiveDayIndex(index)}
                  className={`snap-start flex-shrink-0 group relative flex flex-col items-start justify-center py-4 px-5 md:px-6 min-w-[130px] md:min-w-[150px] border-r border-ink-100 transition-colors ${isActive
                    ? 'bg-ink-900 text-white'
                    : 'bg-white text-ink-700 hover:bg-ink-50'
                    }`}
                >
                  <span className={`font-serif text-xs font-medium tracking-wider mb-1 ${isActive ? 'text-vermillion-100' : 'text-ink-300'}`}>
                    DAY 0{index + 1}
                  </span>
                  <span className={`text-[11px] mb-1.5 font-mono ${isActive ? 'text-white/60' : 'text-ink-500'}`}>
                    {day.date}
                  </span>
                  <span className={`text-sm md:text-base font-semibold ${isActive ? 'text-white' : 'text-ink-900'}`}>
                    {day.dayTitle}
                  </span>
                  {isActive && (
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-vermillion" aria-hidden />
                  )}
                </button>
              );
            })}

            {/* Add Day Button */}
            {isEditing && (
              <button
                onClick={addDay}
                className="snap-start flex-shrink-0 flex items-center justify-center py-4 px-5 min-w-[80px] border-r border-ink-100 text-ink-300 hover:text-ink-900 hover:bg-ink-50 transition-colors"
                title={t('addDay')}
              >
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 mt-6 md:mt-12">

        {/* Day Context Title & Weather — editorial */}
        <div className="mb-8 md:mb-12 flex flex-col gap-5 md:gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="block w-6 h-[1px] bg-vermillion" aria-hidden />
              <span className="text-[10px] md:text-[11px] font-medium tracking-[0.25em] uppercase text-ink-500">
                Itinerary · Day {activeDayIndex + 1}
              </span>
            </div>
            <h2 className="font-serif text-2xl md:text-4xl font-bold text-ink-900 leading-tight">
              {activeDay.theme}
            </h2>
            <p className="mt-2 text-sm md:text-base text-ink-500 leading-relaxed">
              {activeDay.focus}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
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
                  className="w-full py-4 mt-4 border border-dashed border-ink-200 text-ink-500 text-sm font-medium flex items-center justify-center gap-2 hover:border-ink-900 hover:text-ink-900 transition-colors"
                >
                  <Plus size={16} />
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
      <div className="fixed bottom-0 left-0 w-full z-50 bg-white border-t border-ink-100 pb-safe lg:hidden">
        <div className="flex items-center justify-around p-2">
          <button
            onClick={() => setMobileViewMode('list')}
            className={`flex flex-col items-center gap-1 p-2 w-24 transition-colors ${mobileViewMode === 'list'
              ? 'text-ink-900'
              : 'text-ink-300 hover:text-ink-700'
              }`}
          >
            <List size={20} strokeWidth={1.75} />
            <span className="text-[10px] font-medium tracking-wider uppercase">{t('listView')}</span>
          </button>

          <div className="w-[1px] h-8 bg-ink-100"></div>

          <button
            onClick={() => setMobileViewMode('map')}
            className={`flex flex-col items-center gap-1 p-2 w-24 transition-colors ${mobileViewMode === 'map'
              ? 'text-ink-900'
              : 'text-ink-300 hover:text-ink-700'
              }`}
          >
            <MapIcon size={20} strokeWidth={1.75} />
            <span className="text-[10px] font-medium tracking-wider uppercase">{t('mapView')}</span>
          </button>
        </div>
      </div>


      {/* DB Error Toast */}
      {dbError && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-vermillion text-white px-5 py-3 shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm">
          <span className="text-sm font-medium">{dbError}</span>
          <button
            onClick={() => setDbError(null)}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink-900 text-white px-5 py-3 shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-300">
          {successToast}
        </div>
      )}

    </div>
  );
};

export default App;