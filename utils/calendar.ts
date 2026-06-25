import { ItineraryItem } from '../types';

const escapeICS = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const formatUtc = (date: Date): string => date.toISOString().replace(/[-:]|\.\d{3}/g, '');

const formatLocal = (date: Date): string => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
};

export const buildICSContent = (
  item: ItineraryItem,
  isoDate: string,
  generatedAt: Date = new Date(),
): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  const [hours, minutes] = item.time.split(':').map(Number);
  const startDate = new Date(year, month - 1, day, hours, minutes, 0);
  const endDate = new Date(startDate.getTime() + 90 * 60_000);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fukuoka Trip Guide//ZH-TW',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Tokyo',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:JST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${escapeICS(item.id)}@fukuoka-trip-guide`,
    `DTSTAMP:${formatUtc(generatedAt)}`,
    `DTSTART;TZID=Asia/Tokyo:${formatLocal(startDate)}`,
    `DTEND;TZID=Asia/Tokyo:${formatLocal(endDate)}`,
    `SUMMARY:${escapeICS(`福岡行程：${item.title}`)}`,
    `DESCRIPTION:${escapeICS(`${item.description}\n交通：${item.transportDetail}`)}`,
    `LOCATION:${escapeICS(item.address_jp)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

export const downloadICS = (item: ItineraryItem, isoDate: string): void => {
  const blob = new Blob([buildICSContent(item, isoDate)], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${item.title.replace(/[\\/:*?"<>|]/g, '-')}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};