/**
 * exportImport.ts — 行程匯出/匯入工具
 * 
 * - exportItineraryJSON: 匯出全行程為 JSON 檔案下載
 * - importItineraryJSON: 匯入 JSON 檔案，驗證格式後回傳資料
 * - exportAllICS: 匯出全行程為 ICS 日曆檔
 */

import { DayItinerary, ItineraryItem, TransportType } from '../types';

// === JSON Export ===

export const exportItineraryJSON = (itinerary: DayItinerary[], planName: string) => {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    plan: planName,
    itinerary,
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fukuoka-trip-${planName}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// === JSON Import ===

interface ImportResult {
  success: true;
  data: DayItinerary[];
  plan?: string;
}

interface ImportError {
  success: false;
  error: string;
}

/**
 * Validates and parses an uploaded JSON file into DayItinerary[].
 */
export const importItineraryJSON = (file: File): Promise<ImportResult | ImportError> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        // Support both raw array and wrapped format
        let itinerary: DayItinerary[];
        let plan: string | undefined;

        if (Array.isArray(parsed)) {
          itinerary = parsed;
        } else if (parsed.itinerary && Array.isArray(parsed.itinerary)) {
          itinerary = parsed.itinerary;
          plan = parsed.plan;
        } else {
          resolve({ success: false, error: 'Invalid format: expected itinerary array' });
          return;
        }

        // Basic structure validation
        for (const day of itinerary) {
          if (!day.date || !day.dayTitle || !Array.isArray(day.items)) {
            resolve({ success: false, error: 'Invalid day structure: missing date, dayTitle, or items' });
            return;
          }
          for (const item of day.items) {
            if (!item.id || !item.time || !item.title) {
              resolve({ success: false, error: `Invalid item in ${day.date}: missing id, time, or title` });
              return;
            }
          }
        }

        resolve({ success: true, data: itinerary, plan });
      } catch (err) {
        resolve({ success: false, error: 'Failed to parse JSON file' });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file' });
    };

    reader.readAsText(file);
  });
};

// === ICS Export ===

const formatICSDate = (date: Date): string => {
  return date.toISOString().replace(/-|:|\.\d+/g, '');
};

const escapeICS = (text: string): string => {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
};

/**
 * Export all itinerary items as a single ICS calendar file.
 */
export const exportAllICS = (itinerary: DayItinerary[]) => {
  const now = new Date();
  const currentYear = now.getFullYear();

  const events = itinerary.flatMap((day) => {
    const dateMatch = day.date.match(/(\d{1,2})\/(\d{1,2})/);
    if (!dateMatch) return [];

    const month = parseInt(dateMatch[1], 10);
    const dayNum = parseInt(dateMatch[2], 10);
    const tentativeDate = new Date(currentYear, month - 1, dayNum);
    const year = tentativeDate < now ? currentYear + 1 : currentYear;

    return day.items.map((item) => {
      const [hours, minutes] = item.time.split(':').map(Number);
      const startDate = new Date(year, month - 1, dayNum, hours, minutes);
      const endDate = new Date(startDate.getTime() + 90 * 60000); // 1.5 hours default

      return [
        'BEGIN:VEVENT',
        `UID:${item.id}-${day.date}@fukuokatrip.com`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART:${formatICSDate(startDate)}`,
        `DTEND:${formatICSDate(endDate)}`,
        `SUMMARY:${escapeICS(item.title)}`,
        `DESCRIPTION:${escapeICS(item.description)}\\n${escapeICS(item.transportDetail)}`,
        `LOCATION:${escapeICS(item.address_jp)}`,
        'END:VEVENT',
      ].join('\r\n');
    });
  });

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fukuoka Trip Guide//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Fukuoka Trip',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fukuoka-trip-full.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// === Single Item ICS Download ===

/**
 * Download a single itinerary item as an ICS file.
 * (Consolidated from calendar.ts — reuses formatICSDate / escapeICS above)
 */
export const downloadICS = (item: ItineraryItem, dateStr: string) => {
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
  if (!dateMatch) return;

  const month = parseInt(dateMatch[1], 10);
  const day = parseInt(dateMatch[2], 10);

  const now = new Date();
  const currentYear = now.getFullYear();
  const tentativeDate = new Date(currentYear, month - 1, day);
  const year = tentativeDate < now ? currentYear + 1 : currentYear;

  const [hours, minutes] = item.time.split(':').map(Number);
  const startDate = new Date(year, month - 1, day, hours, minutes);
  const endDate = new Date(startDate.getTime() + 90 * 60000);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fukuoka Trip Guide//EN',
    'BEGIN:VEVENT',
    `UID:${item.id}@fukuokatrip.com`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${escapeICS(item.title)}`,
    `DESCRIPTION:${escapeICS(item.description)}\\n${escapeICS(item.transportDetail)}`,
    `LOCATION:${escapeICS(item.address_jp)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${item.title}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
