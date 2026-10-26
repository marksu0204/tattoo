const TAIPEI_TIMEZONE = 'Asia/Taipei';
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TAIPEI_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toDateStringFromDate = (date: Date): string => {
  const parts = dateFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
};

export const getTaipeiToday = (): string => toDateStringFromDate(new Date());

export const parseDateStringToUtcDate = (dateString: string): Date => {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

export const formatUtcDateToDateString = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDaysToDateString = (dateString: string, days: number): string => {
  const date = parseDateStringToUtcDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDateToDateString(date);
};

export const getDateRangeDaysInclusive = (startDate: string, endDate: string): number => {
  const start = parseDateStringToUtcDate(startDate).getTime();
  const end = parseDateStringToUtcDate(endDate).getTime();
  return Math.floor((end - start) / DAY_MS) + 1;
};

export const getPreviousPeriod = (startDate: string, endDate: string): { startDate: string; endDate: string } => {
  const dayCount = getDateRangeDaysInclusive(startDate, endDate);
  const previousEndDate = addDaysToDateString(startDate, -1);
  const previousStartDate = addDaysToDateString(previousEndDate, -(dayCount - 1));
  return { startDate: previousStartDate, endDate: previousEndDate };
};

export type DatePresetKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth';

export const getPresetDateRange = (preset: DatePresetKey): { startDate: string; endDate: string } => {
  const today = getTaipeiToday();

  if (preset === 'today') {
    return { startDate: today, endDate: today };
  }
  if (preset === 'yesterday') {
    const yesterday = addDaysToDateString(today, -1);
    return { startDate: yesterday, endDate: yesterday };
  }
  if (preset === 'last7') {
    return { startDate: addDaysToDateString(today, -6), endDate: today };
  }
  if (preset === 'last30') {
    return { startDate: addDaysToDateString(today, -29), endDate: today };
  }
  if (preset === 'thisMonth') {
    const [year, month] = today.split('-');
    return { startDate: `${year}-${month}-01`, endDate: today };
  }

  const [year, month] = today.split('-').map(Number);
  const thisMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const lastMonthEnd = new Date(thisMonthStart.getTime() - DAY_MS);
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
  return {
    startDate: formatUtcDateToDateString(lastMonthStart),
    endDate: formatUtcDateToDateString(lastMonthEnd),
  };
};

