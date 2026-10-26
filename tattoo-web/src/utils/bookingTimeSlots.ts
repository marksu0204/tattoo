import { AvailabilityWindow, BookedTimeSlot } from '../types';

/** 將 HH:mm 轉為當日分鐘數 */
const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** 分鐘數轉 HH:mm */
const fromMinutes = (total: number): string => {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** 依區間與間隔產生可選時間（不含 endTime 本身） */
export const generateTimeSlots = (
  startTime: string,
  endTime: string,
  intervalMinutes: number
): string[] => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start >= end || intervalMinutes <= 0) return [];

  const slots: string[] = [];
  for (let t = start; t < end; t += intervalMinutes) {
    slots.push(fromMinutes(t));
  }
  return slots;
};

export const dateHasAvailability = (
  dateStr: string,
  windows: AvailabilityWindow[],
  legacyOpenSlots: Array<{ date: string }>
): boolean => {
  if (windows.some((w) => w.date === dateStr)) return true;
  return legacyOpenSlots.some((s) => s.date === dateStr);
};

export const getAvailableTimesForDate = (
  dateStr: string,
  windows: AvailabilityWindow[],
  legacyOpenSlots: Array<{ date: string; timeSlot: string }>,
  bookedSlots: BookedTimeSlot[]
): string[] => {
  const times = new Set<string>();

  windows
    .filter((w) => w.date === dateStr)
    .forEach((w) => {
      generateTimeSlots(w.startTime, w.endTime, w.intervalMinutes).forEach((t) => times.add(t));
    });

  legacyOpenSlots
    .filter((s) => s.date === dateStr)
    .forEach((s) => times.add(s.timeSlot));

  bookedSlots
    .filter((b) => b.date === dateStr)
    .forEach((b) => times.delete(b.timeSlot));

  return Array.from(times).sort();
};
