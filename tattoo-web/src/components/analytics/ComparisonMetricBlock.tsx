import React from 'react';
import {
  calculateAbsoluteChange,
  calculateCountChange,
  calculateRatePointChange,
  ComparisonChange,
  ComparisonStatus,
  formatComparisonChange,
  getComparisonToneClass,
} from '../../utils/analyticsComparison';

const toNumber = (value: number): string => value.toLocaleString('zh-TW');

export const ComparisonMetricBlock: React.FC<{
  enabled: boolean;
  status: ComparisonStatus;
  current: number;
  previous: number | undefined;
  kind: 'count' | 'rate' | 'absolute';
  formatValue?: (value: number) => string;
  comparisonLabel?: string;
}> = ({
  enabled,
  status,
  current,
  previous,
  kind,
  formatValue,
  comparisonLabel = '比較期',
}) => {
  if (!enabled) return null;
  if (status === 'loading') return <p className="text-[10px] text-gray-500 mt-0.5">比較資料載入中…</p>;
  if (status === 'error') return <p className="text-[10px] text-red-300 mt-0.5">比較期間資料載入失敗</p>;
  if (status === 'partial') return <p className="text-[10px] text-amber-300 mt-0.5">比較資料部分不完整</p>;
  if (status === 'unavailable') return <p className="text-[10px] text-amber-300 mt-0.5">比較期間無完整追蹤資料</p>;
  if (status !== 'ready' || previous === undefined) return null;

  let change: ComparisonChange;
  if (kind === 'count') change = calculateCountChange(current, previous);
  else if (kind === 'rate') change = calculateRatePointChange(current, previous);
  else change = calculateAbsoluteChange(current, previous);

  const comparisonText = formatValue ? formatValue(previous) : toNumber(previous);

  return (
    <div className="mt-0.5 space-y-0.5">
      <p className={`text-[10px] ${getComparisonToneClass(change)}`}>{formatComparisonChange(change)}</p>
      <p className="text-[10px] text-gray-500">{comparisonLabel} {comparisonText}</p>
    </div>
  );
};

export const ComparisonLineBlock: React.FC<{
  enabled: boolean;
  status: ComparisonStatus;
  currentValue: number;
  previousValue: number;
  kind: 'count' | 'rate' | 'absolute';
  formatValue?: (value: number) => string;
  comparisonLabel?: string;
}> = ({
  enabled,
  status,
  currentValue,
  previousValue,
  kind,
  formatValue,
  comparisonLabel = '比較期',
}) => (
  <ComparisonMetricBlock
    enabled={enabled}
    status={status}
    current={currentValue}
    previous={previousValue}
    kind={kind}
    formatValue={formatValue}
    comparisonLabel={comparisonLabel}
  />
);
