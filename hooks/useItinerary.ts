import { useState, useEffect, useCallback } from 'react';
import { DayItinerary, ItineraryItem, TransportType } from '../types';
import { getAllItineraries, saveDayItinerary, deleteDayItinerary, resetItineraries } from '../utils/db';
import { ITINERARY_DATA, getItineraryData2 } from '../constants'; // Fallback
import { ItineraryPlanType } from '../utils/dataLoader';

export const useItinerary = () => {
  const [activePlan, setActivePlan] = useState<ItineraryPlanType>('plan1');
  const [itinerary, setItinerary] = useState<DayItinerary[]>(ITINERARY_DATA); // Init with static first to prevent flash
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Get fallback data based on active plan
  const getFallbackData = useCallback(() => {
    return activePlan === 'plan1' ? ITINERARY_DATA : getItineraryData2();
  }, [activePlan]);

  // Load from DB on mount and when plan changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getAllItineraries(activePlan);
        // Sort by "Day X" number
        const sortedData = data.sort((a, b) => {
           const getDayNum = (title: string) => {
             const match = title.match(/Day (\d+)/);
             return match ? parseInt(match[1], 10) : 999;
           };
           return getDayNum(a.dayTitle) - getDayNum(b.dayTitle);
        });
        setItinerary(sortedData);
      } catch (error) {
        console.error('Failed to load itinerary from DB:', error);
        setItinerary(getFallbackData());
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activePlan, getFallbackData]);

  /**
   * Switch to a different itinerary plan
   */
  const switchPlan = useCallback((plan: ItineraryPlanType) => {
    if (plan !== activePlan) {
      setActivePlan(plan);
    }
  }, [activePlan]);

  // Helper to sort items by time
  const sortItemsByTime = (items: ItineraryItem[]): ItineraryItem[] => {
    return [...items].sort((a, b) => {
      const timeTOminutes = (str: string) => {
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
      };
      return timeTOminutes(a.time) - timeTOminutes(b.time);
    });
  };

  const updateItem = useCallback((dayDate: string, updatedItem: ItineraryItem) => {
    setItinerary(prev => {
      const newItinerary = prev.map(day => {
        if (day.date === dayDate) {
          const newItems = day.items.map(item =>
            item.id === updatedItem.id ? updatedItem : item
          );
          return { ...day, items: newItems };
        }
        return day;
      });

      // Persist to DB outside the pure state updater
      const updatedDay = newItinerary.find(d => d.date === dayDate);
      if (updatedDay) {
        saveDayItinerary(updatedDay, activePlan).catch(err => console.error('Save failed:', err));
      }

      return newItinerary;
    });
  }, [activePlan]);

  const addItem = useCallback((dayDate: string) => {
    setItinerary(prev => {
      const newItinerary = prev.map(day => {
        if (day.date === dayDate) {
          const newItem: ItineraryItem = {
            id: `item-${Date.now()}`,
            time: '09:00',
            title: '新行程',
            description: '',
            address_jp: '',
            address_en: '',
            transportType: TransportType.WALK,
            transportDetail: '步行',
            coordinates: { lat: 33.5902, lng: 130.4017 },
            googleMapsQuery: '博多駅',
            recommendedFood: [],
            nearbySpots: []
          };
          const sortedItems = sortItemsByTime([...day.items, newItem]);
          return { ...day, items: sortedItems };
        }
        return day;
      });

      const updatedDay = newItinerary.find(d => d.date === dayDate);
      if (updatedDay) {
        saveDayItinerary(updatedDay, activePlan).catch(err => console.error('Save failed:', err));
      }

      return newItinerary;
    });
  }, [activePlan]);

  const deleteItem = useCallback((dayDate: string, itemId: string) => {
    if (!window.confirm('確定要刪除此行程嗎？')) return;

    setItinerary(prev => {
      const newItinerary = prev.map(day => {
        if (day.date === dayDate) {
          return { ...day, items: day.items.filter(item => item.id !== itemId) };
        }
        return day;
      });

      const updatedDay = newItinerary.find(d => d.date === dayDate);
      if (updatedDay) {
        saveDayItinerary(updatedDay, activePlan).catch(err => console.error('Save failed:', err));
      }

      return newItinerary;
    });
  }, [activePlan]);

  const addDay = useCallback(() => {
    setItinerary(prev => {
      const lastDay = prev[prev.length - 1];
      let newDayNum = 1;
      let newDateStr = 'New Date';

      if (lastDay) {
        const match = lastDay.dayTitle.match(/Day (\d+)/);
        if (match) {
          newDayNum = parseInt(match[1], 10) + 1;
        }

        const dateMatch = lastDay.date.match(/(\d+)\/(\d+)\s*\((.)\)/);
        if (dateMatch) {
          const month = parseInt(dateMatch[1], 10);
          const day = parseInt(dateMatch[2], 10);
          const now = new Date();
          const year = now.getFullYear();
          const lastDateObj = new Date(year, month - 1, day);
          lastDateObj.setDate(lastDateObj.getDate() + 1);

          const newMonth = lastDateObj.getMonth() + 1;
          const newDayVal = lastDateObj.getDate();
          const dayOfWeekIndex = lastDateObj.getDay();
          const days = ['日', '一', '二', '三', '四', '五', '六'];
          newDateStr = `${newMonth}/${newDayVal} (${days[dayOfWeekIndex]})`;
        } else {
          newDateStr = `${new Date().getMonth() + 1}/${new Date().getDate()} (New)`;
        }
      }

      const newDay: DayItinerary = {
        date: newDateStr,
        dayTitle: `Day ${newDayNum}`,
        theme: '自由探索',
        focus: '新增的行程',
        items: []
      };

      // Persist outside the pure state updater
      saveDayItinerary(newDay, activePlan).catch(err => console.error('Save failed:', err));

      return [...prev, newDay];
    });
  }, [activePlan]);

  const deleteDay = useCallback((dayDate: string) => {
    if (!window.confirm('確定要刪除這整天的行程嗎？此動作無法復原。')) return;

    setItinerary(prev => prev.filter(d => d.date !== dayDate));
    // Sync deletion to IndexedDB
    deleteDayItinerary(dayDate, activePlan).catch(err => console.error('Delete day from DB failed:', err));
  }, [activePlan]);

  const resetToDefault = useCallback(async () => {
    if (!window.confirm('確定要還原成預設行程嗎？您的修改將會消失。')) return;
    
    setLoading(true);
    try {
      const defaultData = await resetItineraries(activePlan);
      setItinerary(defaultData);
    } catch (error) {
      console.error('Reset failed:', error);
    } finally {
      setLoading(false);
    }
  }, [activePlan]);

  const importItinerary = useCallback(async (data: DayItinerary[]) => {
    setLoading(true);
    try {
      // Save all days to DB
      for (const day of data) {
        await saveDayItinerary(day, activePlan);
      }
      setItinerary(data);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setLoading(false);
    }
  }, [activePlan]);

  return {
    itinerary,
    loading,
    isEditing,
    setIsEditing,
    updateItem,
    addItem,
    deleteItem,
    addDay,
    deleteDay,
    resetToDefault,
    activePlan,
    switchPlan,
    importItinerary,
  };
};
