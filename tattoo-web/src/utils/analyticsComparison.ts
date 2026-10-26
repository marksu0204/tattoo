export type ComparisonStatus = 'off' | 'loading' | 'ready' | 'partial' | 'unavailable' | 'error';

export type ComparisonChange =
  | { type: 'none'; direction: 'flat'; value: null }
  | { type: 'new'; direction: 'up'; value: null }
  | { type: 'percent'; direction: 'up' | 'down' | 'flat'; value: number }
  | { type: 'percentage_point'; direction: 'up' | 'down' | 'flat'; value: number }
  | { type: 'absolute'; direction: 'up' | 'down' | 'flat'; value: number };

export const calculateCountChange = (current: number, previous: number): ComparisonChange => {
  if (previous === 0 && current === 0) return { type: 'none', direction: 'flat', value: null };
  if (previous === 0 && current > 0) return { type: 'new', direction: 'up', value: null };
  const ratio = ((current - previous) / previous) * 100;
  if (ratio > 0) return { type: 'percent', direction: 'up', value: ratio };
  if (ratio < 0) return { type: 'percent', direction: 'down', value: ratio };
  return { type: 'percent', direction: 'flat', value: 0 };
};

export const calculateRatePointChange = (currentRate: number, previousRate: number): ComparisonChange => {
  const points = (currentRate - previousRate) * 100;
  if (points > 0) return { type: 'percentage_point', direction: 'up', value: points };
  if (points < 0) return { type: 'percentage_point', direction: 'down', value: points };
  return { type: 'percentage_point', direction: 'flat', value: 0 };
};

export const calculateAbsoluteChange = (current: number, previous: number): ComparisonChange => {
  const diff = current - previous;
  if (diff > 0) return { type: 'absolute', direction: 'up', value: diff };
  if (diff < 0) return { type: 'absolute', direction: 'down', value: diff };
  return { type: 'absolute', direction: 'flat', value: 0 };
};

export const formatComparisonChange = (change: ComparisonChange): string => {
  if (change.type === 'none') return '—';
  if (change.type === 'new') return '↑ 新增';
  const symbol = change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '—';
  if (change.type === 'percent') {
    const num = change.value ?? 0;
    const sign = num > 0 ? '+' : '';
    return `${symbol} ${sign}${num.toFixed(1)}%`;
  }
  if (change.type === 'percentage_point') {
    const num = change.value ?? 0;
    const sign = num > 0 ? '+' : '';
    return `${symbol} ${sign}${num.toFixed(2)} pp`;
  }
  const num = change.value ?? 0;
  const sign = num > 0 ? '+' : '';
  return `${symbol} ${sign}${num.toLocaleString('zh-TW')}`;
};

export const getComparisonToneClass = (change: ComparisonChange): string => {
  if (change.direction === 'up') return 'text-green-400';
  if (change.direction === 'down') return 'text-red-400';
  return 'text-gray-400';
};

