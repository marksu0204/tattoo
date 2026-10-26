import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Heart, Instagram, Info, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { db } from '../services/mockBackend';
import type { AnalyticsCompareMode, AnalyticsLabelDimension, AnalyticsLabelFields, AnalyticsV2ArtworkRow, AnalyticsV2BookingMetrics, AnalyticsV2CampaignRow, AnalyticsV2ComparisonMeta, AnalyticsV2ContentRow, AnalyticsV2PeriodData, AnalyticsV2Response, AnalyticsV2SourceRow, AnalyticsV2TrendPoint } from '../types';
import { calculateCountChange, calculateRatePointChange, ComparisonStatus, formatComparisonChange, getComparisonToneClass } from '../utils/analyticsComparison';
import { CampaignAttributionList, ContentAttributionList, SourceAttributionList } from './analytics/AttributionDataList';
import { ComparisonLineBlock, ComparisonMetricBlock } from './analytics/ComparisonMetricBlock';
import MetaAdsImportPanel from './MetaAdsImportPanel';
import MemberGrowthPanel from './MemberGrowthPanel';
import { DatePresetKey, getDateRangeDaysInclusive, getPresetDateRange, getPreviousPeriod, getTaipeiToday } from '../utils/taipeiDate';
import {
  ANALYTICS_MIN_SAMPLE_SESSIONS,
  type AttributionSortKey,
  buildContentTagContext,
  findBestPerformer,
  formatAnalyticsRawSubtitle,
  formatSourceRawSources,
  getAnalyticsPrimaryName,
  getContentPerformanceTags,
  getNormalizedSourceDisplay,
  getSourceLabelRawValue,
  getSourcePresentation,
  isFunnelLowSample,
  makeCampaignKey,
  makeContentKey,
  makeSourceKey,
  normalizeAnalyticsArtworkConversionFields,
  normalizeAnalyticsBooking,
  normalizeAnalyticsChannelLeads,
  normalizeAnalyticsConversionFields,
  normalizeAnalyticsFunnel,
  normalizeAnalyticsLabelFields,
  normalizeAnalyticsSourceKey,
  sortAttributionRows,
  sortSourceRows,
  sourcesMatchNormalizedFilter,
  toAnalyticsLabelRawValue,
  toCampaignDisplayName,
  toContentDisplayName,
} from '../utils/analyticsAttribution';

type Granularity = 'daily' | 'weekly' | 'monthly';
type ArtworkSortKey = 'views' | 'favAdds' | 'lineContacts' | 'instagramContacts' | 'uniqueContactSessions' | 'sessionContactRate' | 'viewSessions' | 'leadSessions' | 'viewToLeadRate' | 'bookingStartSessions' | 'bookingCompleteSessions' | 'bookingRate';

const MAX_RANGE_DAYS = 366;
const PRESET_OPTIONS: Array<{ key: DatePresetKey; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'last7', label: '最近7天' },
  { key: 'last30', label: '最近30天' },
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
];

const toNumber = (value: number): string => value.toLocaleString('zh-TW');
const toPercent = (value: number, digits = 1): string => `${(value * 100).toFixed(digits)}%`;

const toShortDate = (dateString: string): string => {
  const [, m, d] = dateString.split('-');
  return `${Number(m)}/${Number(d)}`;
};

const toTaipeiDateTimeText = (isoString: string | null): string => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  const formatter = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date).replace(/\//g, '/').replace(',', '');
};

const resolveGranularity = (startDate: string, endDate: string): Granularity => {
  const days = getDateRangeDaysInclusive(startDate, endDate);
  if (days <= 31) return 'daily';
  if (days <= 120) return 'weekly';
  return 'monthly';
};

const getTrendLabel = (point: AnalyticsV2TrendPoint, granularity: Granularity): string => {
  if (granularity === 'daily' && 'date' in point) return toShortDate(point.date);
  if (granularity === 'weekly' && 'weekStartDate' in point) return `週 ${toShortDate(point.weekStartDate)}`;
  if (granularity === 'monthly' && 'month' in point) {
    const [year, month] = point.month.split('-');
    return `${year}/${month}`;
  }
  return '';
};

const getValidationMessage = (startDate: string, endDate: string): string | null => {
  if (!startDate || !endDate) return '請選擇開始與結束日期。';
  if (startDate > endDate) return '開始日期不可晚於結束日期。';
  const days = getDateRangeDaysInclusive(startDate, endDate);
  if (days > MAX_RANGE_DAYS) return '日期區間最多可查詢 366 天。';
  return null;
};

const getComparisonValidationMessage = (
  compareMode: AnalyticsCompareMode,
  comparisonStart: string,
  comparisonEnd: string
): string | null => {
  if (compareMode !== 'custom') return null;
  if (!comparisonStart || !comparisonEnd) return '請選擇比較期間的開始與結束日期。';
  if (comparisonStart > comparisonEnd) return '比較開始日期不可晚於結束日期。';
  const days = getDateRangeDaysInclusive(comparisonStart, comparisonEnd);
  if (days > MAX_RANGE_DAYS) return '比較日期區間最多可查詢 366 天。';
  return null;
};

const IS_DEV = import.meta.env.DEV;

const debugRequest = (payload: Record<string, unknown>) => {
  if (!IS_DEV) return;
  console.debug('[AnalyticsV2]', payload);
};

type TrendMetric = 'views' | 'favAdds' | 'uniqueContactSessions';
type TrendChartItem = {
  label: string;
  views: number;
  favAdds: number;
  uniqueContactSessions: number;
};

const TrendBarChart: React.FC<{
  data: TrendChartItem[];
  enabledMetrics: Record<TrendMetric, boolean>;
}> = ({ data, enabledMetrics }) => {
  const hasAnyMetric = enabledMetrics.views || enabledMetrics.favAdds || enabledMetrics.uniqueContactSessions;
  const metricDefs: Array<{ key: TrendMetric; label: string; color: string }> = [
    { key: 'views', label: '瀏覽', color: 'bg-blue-500' },
    { key: 'favAdds', label: '收藏', color: 'bg-pink-500' },
    { key: 'uniqueContactSessions', label: '詢問', color: 'bg-primary' },
  ];
  const chartMetrics = metricDefs.filter((metric) => enabledMetrics[metric.key]);

  const maxVal = Math.max(
    1,
    ...data.map((item) => Math.max(
      enabledMetrics.views ? item.views : 0,
      enabledMetrics.favAdds ? item.favAdds : 0,
      enabledMetrics.uniqueContactSessions ? item.uniqueContactSessions : 0,
    ))
  );

  if (!data.length) {
    return <div className="h-36 flex items-center justify-center text-gray-500 text-sm">此期間尚無分析資料。</div>;
  }
  if (!hasAnyMetric) {
    return <div className="h-36 flex items-center justify-center text-gray-500 text-sm">請至少選擇一個趨勢指標。</div>;
  }

  const chartHeight = 140;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${Math.max(data.length * 40, 320)}px` }}>
        <div className="flex items-end gap-1 border-b border-white/10" style={{ height: `${chartHeight}px` }}>
          {data.map((item, idx) => (
            <div key={`${item.label}-${idx}`} className="group relative flex flex-1 items-end justify-center gap-0.5">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/90 border border-gray-700 text-white text-xs px-2 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 z-20 pointer-events-none transition-opacity">
                <p className="font-bold text-gray-300 mb-1 text-center">{item.label}</p>
                {enabledMetrics.views && <p className="text-blue-400">瀏覽：{toNumber(item.views)}</p>}
                {enabledMetrics.favAdds && <p className="text-pink-400">收藏：{toNumber(item.favAdds)}</p>}
                {enabledMetrics.uniqueContactSessions && <p className="text-primary">詢問：{toNumber(item.uniqueContactSessions)}</p>}
              </div>
              {chartMetrics.map((metric) => {
                const value = item[metric.key];
                return (
                  <div
                    key={metric.key}
                    className={`w-2.5 ${metric.color} rounded-t-sm transition-all`}
                    style={{
                      height: `${(value / maxVal) * chartHeight}px`,
                      minHeight: value > 0 ? '2px' : '0',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-1">
          {data.map((item, idx) => (
            <div key={`${item.label}-axis-${idx}`} className="flex-1 text-center text-[10px] text-gray-500">
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

type LabelFilterMode = 'all' | 'unlabeled';

type LabelModalState = {
  dimension: AnalyticsLabelDimension;
  rawValue: string;
  displayName: string;
  note: string;
  isLabeled: boolean;
};

const DIMENSION_LABELS: Record<AnalyticsLabelDimension, string> = {
  source: 'Source',
  campaign: 'Campaign',
  content: 'Content',
};

const normalizeAnalyticsPeriodData = (period: AnalyticsV2PeriodData): AnalyticsV2PeriodData => ({
  ...period,
  funnel: normalizeAnalyticsFunnel(period.funnel),
  channelLeads: normalizeAnalyticsChannelLeads(period.channelLeads),
  booking: normalizeAnalyticsBooking(period.booking, normalizeAnalyticsFunnel(period.funnel).totalSessions),
  byArtwork: (period.byArtwork ?? []).map((row) => ({
    ...row,
    ...normalizeAnalyticsArtworkConversionFields(row),
  })),
  bySource: (period.bySource ?? []).map((row) => ({
    ...row,
    source: normalizeAnalyticsSourceKey(row.source),
    rawSources: row.rawSources?.length ? row.rawSources : [row.source],
    ...normalizeAnalyticsLabelFields('source', row),
    ...normalizeAnalyticsConversionFields(row),
  })),
  byCampaign: (period.byCampaign ?? []).map((row) => ({
    ...row,
    ...normalizeAnalyticsLabelFields('campaign', row),
    ...normalizeAnalyticsConversionFields(row),
  })),
  byContent: (period.byContent ?? []).map((row) => ({
    ...row,
    ...normalizeAnalyticsLabelFields('content', row),
    ...normalizeAnalyticsConversionFields(row),
  })),
});

const normalizeAnalyticsV2Response = (response: AnalyticsV2Response): AnalyticsV2Response => ({
  ...response,
  funnel: normalizeAnalyticsFunnel(response.funnel),
  channelLeads: normalizeAnalyticsChannelLeads(response.channelLeads),
  booking: normalizeAnalyticsBooking(response.booking, normalizeAnalyticsFunnel(response.funnel).totalSessions),
  byArtwork: (response.byArtwork ?? []).map((row) => ({
    ...row,
    ...normalizeAnalyticsArtworkConversionFields(row),
  })),
  bySource: (response.bySource ?? []).map((row) => ({
    ...row,
    source: normalizeAnalyticsSourceKey(row.source),
    rawSources: row.rawSources?.length ? row.rawSources : [row.source],
    ...normalizeAnalyticsLabelFields('source', row),
    ...normalizeAnalyticsConversionFields(row),
  })),
  byCampaign: (response.byCampaign ?? []).map((row) => ({
    ...row,
    ...normalizeAnalyticsLabelFields('campaign', row),
    ...normalizeAnalyticsConversionFields(row),
  })),
  byContent: (response.byContent ?? []).map((row) => ({
    ...row,
    ...normalizeAnalyticsLabelFields('content', row),
    ...normalizeAnalyticsConversionFields(row),
  })),
  comparison: response.comparison ? normalizeAnalyticsPeriodData(response.comparison) : undefined,
});

const patchAnalyticsLabelFields = (
  response: AnalyticsV2Response,
  dimension: AnalyticsLabelDimension,
  rawValue: string,
  fields: AnalyticsLabelFields
): AnalyticsV2Response => {
  const matches = (value: string | null | undefined) => toAnalyticsLabelRawValue(dimension, value) === rawValue;
  return {
    ...response,
    bySource: dimension === 'source'
      ? response.bySource.map((row) => {
          const rawSources = row.rawSources ?? [row.source];
          const hit = rawSources.some((raw) => matches(raw));
          return hit ? { ...row, ...fields } : row;
        })
      : response.bySource,
    byCampaign: dimension === 'campaign'
      ? response.byCampaign.map((row) => (matches(row.campaign) ? { ...row, ...fields } : row))
      : response.byCampaign,
    byContent: dimension === 'content'
      ? response.byContent.map((row) => (matches(row.content) ? { ...row, ...fields } : row))
      : response.byContent,
  };
};

const patchPeriodLabelFields = (
  period: AnalyticsV2PeriodData,
  dimension: AnalyticsLabelDimension,
  rawValue: string,
  fields: AnalyticsLabelFields
): AnalyticsV2PeriodData => {
  const matches = (value: string | null | undefined) => toAnalyticsLabelRawValue(dimension, value) === rawValue;
  return {
    ...period,
    bySource: dimension === 'source'
      ? period.bySource.map((row) => {
          const rawSources = row.rawSources ?? [row.source];
          const hit = rawSources.some((raw) => matches(raw));
          return hit ? { ...row, ...fields } : row;
        })
      : period.bySource,
    byCampaign: dimension === 'campaign'
      ? period.byCampaign.map((row) => (matches(row.campaign) ? { ...row, ...fields } : row))
      : period.byCampaign,
    byContent: dimension === 'content'
      ? period.byContent.map((row) => (matches(row.content) ? { ...row, ...fields } : row))
      : period.byContent,
  };
};

const LabelFilterToggle: React.FC<{
  value: LabelFilterMode;
  onChange: (value: LabelFilterMode) => void;
}> = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg border border-white/10 overflow-hidden text-xs">
    <button
      type="button"
      onClick={() => onChange('all')}
      className={`px-2.5 py-1.5 ${value === 'all' ? 'bg-primary text-black' : 'bg-black/30 text-gray-300 hover:text-white'}`}
    >
      全部
    </button>
    <button
      type="button"
      onClick={() => onChange('unlabeled')}
      className={`px-2.5 py-1.5 ${value === 'unlabeled' ? 'bg-primary text-black' : 'bg-black/30 text-gray-300 hover:text-white'}`}
    >
      只看未命名
    </button>
  </div>
);

const LowSampleBadge: React.FC<{ sessions: number }> = ({ sessions }) => {
  if (!isFunnelLowSample(sessions)) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-700/30">
      樣本較少
    </span>
  );
};

const ConversionFunnelPanel: React.FC<{
  funnel: AnalyticsV2Response['funnel'];
  channelLeads: AnalyticsV2Response['channelLeads'];
  compareActive?: boolean;
  comparisonStatus?: ComparisonStatus;
  previousFunnel?: AnalyticsV2Response['funnel'];
  comparisonLabel?: string;
}> = ({ funnel, channelLeads, compareActive = false, comparisonStatus = 'off', previousFunnel, comparisonLabel = '比較期' }) => {
  const steps = [
    {
      label: '追蹤 Session',
      count: funnel.totalSessions,
      previousCount: previousFunnel?.totalSessions,
      rateLabel: null as string | null,
      rate: null as number | null,
      previousRate: null as number | null,
      kind: 'count' as const,
    },
    {
      label: '查看作品',
      count: funnel.viewSessions,
      previousCount: previousFunnel?.viewSessions,
      rateLabel: 'View Rate',
      rate: funnel.viewRate,
      previousRate: previousFunnel?.viewRate,
      kind: 'rate' as const,
    },
    {
      label: '產生詢問',
      count: funnel.leadSessions,
      previousCount: previousFunnel?.leadSessions,
      rateLabel: 'Lead Conversion',
      rate: funnel.leadConversionRate,
      previousRate: previousFunnel?.leadConversionRate,
      extraRateLabel: 'View → Lead',
      extraRate: funnel.viewToLeadRate,
      previousExtraRate: previousFunnel?.viewToLeadRate,
      kind: 'rate' as const,
    },
  ];

  return (
    <div className="bg-card rounded-xl p-5 border border-white/5 space-y-4">
      <div>
        <h3 className="font-bold text-white">轉換漏斗</h3>
        <p className="text-xs text-gray-500 mt-1">以 Session 去重計算；首欄為有完整追蹤紀錄的 Session，不代表全站訪客。</p>
      </div>
      <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-stretch">
        {steps.map((step, index) => (
          <React.Fragment key={step.label}>
            {index > 0 && (
              <div className="hidden md:flex items-center justify-center text-gray-600 text-xl">→</div>
            )}
            <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-2">
              <p className="text-xs text-gray-500">{step.label}</p>
              <p className="text-2xl font-bold text-white">{toNumber(step.count)}</p>
              <ComparisonMetricBlock
                enabled={compareActive}
                status={comparisonStatus}
                current={step.count}
                previous={step.previousCount}
                kind="count"
                comparisonLabel={comparisonLabel}
              />
              {step.rateLabel && step.rate !== null && (
                <p className="text-xs text-gray-400">
                  {step.rateLabel} {toPercent(step.rate, 2)}
                </p>
              )}
              {step.rateLabel && step.rate !== null && step.previousRate !== undefined && step.previousRate !== null && (
                <ComparisonMetricBlock
                  enabled={compareActive}
                  status={comparisonStatus}
                  current={step.rate}
                  previous={step.previousRate}
                  kind="rate"
                  formatValue={(v) => toPercent(v, 2)}
                  comparisonLabel={comparisonLabel}
                />
              )}
              {'extraRateLabel' in step && step.extraRateLabel && step.extraRate !== undefined && step.extraRate !== null && (
                <p className="text-xs text-primary">
                  {step.extraRateLabel} {toPercent(step.extraRate, 2)}
                </p>
              )}
              {'extraRateLabel' in step && step.extraRate !== undefined && step.extraRate !== null && step.previousExtraRate !== undefined && (
                <ComparisonMetricBlock
                  enabled={compareActive}
                  status={comparisonStatus}
                  current={step.extraRate}
                  previous={step.previousExtraRate}
                  kind="rate"
                  formatValue={(v) => toPercent(v, 2)}
                  comparisonLabel={comparisonLabel}
                />
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="border-t border-white/10 pt-4">
        <p className="text-xs text-gray-500 mb-1">詢問 Session 依管道統計（非互斥）</p>
        <p className="text-[11px] text-gray-600 mb-3">同一 Session 可能同時點擊 LINE 與 Instagram，各管道加總可能大於 Lead Sessions。</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {channelLeads.channels.map((item) => (
            <div key={item.channel} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-gray-500">
                {item.channel === 'line' ? 'LINE Sessions' : item.channel === 'instagram' ? 'Instagram Sessions' : '其他 Sessions'}
              </p>
              <p className="text-xl font-bold text-white mt-1">{toNumber(item.leadSessions)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Lead Session 觸發率 {toPercent(item.leadSessionTriggerRate, 1)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const BookingFunnelPanel: React.FC<{
  booking: AnalyticsV2BookingMetrics;
  compareActive?: boolean;
  comparisonStatus?: ComparisonStatus;
  previousBooking?: AnalyticsV2BookingMetrics;
  comparisonLabel?: string;
}> = ({ booking, compareActive = false, comparisonStatus = 'off', previousBooking, comparisonLabel = '比較期' }) => {
  const steps = [
    { label: '開始預約', sessions: booking.startSessions, previousSessions: previousBooking?.startSessions },
    { label: '選擇日期', sessions: booking.dateSelectedSessions, previousSessions: previousBooking?.dateSelectedSessions },
    { label: '選擇時間', sessions: booking.timeSelectedSessions, previousSessions: previousBooking?.timeSelectedSessions },
    { label: '完成預約', sessions: booking.completeSessions, previousSessions: previousBooking?.completeSessions },
    { label: 'LINE確認', sessions: booking.lineClickSessions, previousSessions: previousBooking?.lineClickSessions },
  ];

  return (
    <div className="bg-card rounded-xl p-5 border border-white/5 space-y-4">
      <div>
        <h3 className="font-bold text-white">預約轉換</h3>
        <p className="text-xs text-gray-500 mt-1">
          以 Session 去重計算；各階段轉換率為上一階段 → 本階段。
          Start → Complete Rate {toPercent(booking.startToCompleteRate, 1)}
        </p>
      </div>
      <div className="max-w-md space-y-1">
        {steps.map((step, index) => {
          const previousStepSessions = index > 0 ? steps[index - 1].sessions : null;
          const stepRate = previousStepSessions !== null && previousStepSessions > 0
            ? step.sessions / previousStepSessions
            : null;
          return (
            <React.Fragment key={step.label}>
              {index > 0 && (
                <div className="text-center text-xs text-gray-500 py-0.5">
                  ↓ {stepRate !== null ? toPercent(stepRate, 1) : '—'}
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs text-gray-500">{step.label}</p>
                <p className="text-2xl font-bold text-white">{toNumber(step.sessions)}</p>
                <ComparisonMetricBlock
                  enabled={compareActive}
                  status={comparisonStatus}
                  current={step.sessions}
                  previous={step.previousSessions}
                  kind="count"
                  comparisonLabel={comparisonLabel}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300">詳細資料</summary>
        <p className="mt-2">送出預約 Session：{toNumber(booking.submitSessions)}（不計入主要漏斗）</p>
      </details>
    </div>
  );
};

const AttributionSortSelect: React.FC<{
  value: AttributionSortKey;
  onChange: (value: AttributionSortKey) => void;
}> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as AttributionSortKey)}
    className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
  >
    <option value="sessions">Sessions 最多</option>
    <option value="leadSessions">Lead Sessions 最多</option>
    <option value="leadRate">Lead Rate 最高</option>
    <option value="viewToLeadRate">View → Lead 最高</option>
    <option value="bookingSessions">Booking Sessions 最多</option>
    <option value="bookingRate">Booking Rate 最高</option>
    <option value="views">瀏覽最多</option>
    <option value="inquiry">詢問 Session 最多</option>
    <option value="inquiryRate">詢問率最高</option>
    <option value="favoriteRate">收藏率最高</option>
  </select>
);

const AnalyticsLabelNameCell: React.FC<{
  dimension: AnalyticsLabelDimension;
  row: AnalyticsV2SourceRow | AnalyticsV2CampaignRow | AnalyticsV2ContentRow;
  onEdit: () => void;
}> = ({ dimension, row, onEdit }) => {
  const rawValue = dimension === 'source'
    ? getSourceLabelRawValue(row as AnalyticsV2SourceRow)
    : dimension === 'campaign'
      ? (row as AnalyticsV2CampaignRow).campaign
      : (row as AnalyticsV2ContentRow).content;
  const normalizedRaw = toAnalyticsLabelRawValue(dimension, rawValue);
  const primaryName = getAnalyticsPrimaryName(dimension, row);
  const isLabeled = row.isLabeled ?? false;
  const sourceRawSources = dimension === 'source'
    ? (row as AnalyticsV2SourceRow).rawSources ?? [(row as AnalyticsV2SourceRow).source]
    : null;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-white text-sm">{primaryName}</p>
        <button
          type="button"
          onClick={onEdit}
          className="text-[11px] text-primary hover:underline"
        >
          {isLabeled ? '編輯' : '命名'}
        </button>
      </div>
      {dimension === 'source' && sourceRawSources && (
        <p className="text-[10px] text-gray-500 mt-0.5 break-all">
          raw: {formatSourceRawSources(sourceRawSources)}
        </p>
      )}
      {isLabeled && dimension !== 'source' && (
        <p className="text-[10px] text-gray-500 mt-0.5 break-all">{formatAnalyticsRawSubtitle(dimension, normalizedRaw)}</p>
      )}
      {isLabeled && row.note && (
        <p className="text-[10px] text-gray-500 mt-0.5">{row.note}</p>
      )}
    </div>
  );
};

const AnalyticsTab: React.FC = () => {
  const initialRange = getPresetDateRange('last7');
  const initialPrevious = getPreviousPeriod(initialRange.startDate, initialRange.endDate);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey | 'custom'>('last7');
  const [data, setData] = useState<AnalyticsV2Response | null>(null);
  const [comparisonPeriod, setComparisonPeriod] = useState<AnalyticsV2PeriodData | null>(null);
  const [comparisonMeta, setComparisonMeta] = useState<AnalyticsV2ComparisonMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [comparisonRequestError, setComparisonRequestError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<AnalyticsCompareMode>('none');
  const [customComparisonStart, setCustomComparisonStart] = useState(initialPrevious.startDate);
  const [customComparisonEnd, setCustomComparisonEnd] = useState(initialPrevious.endDate);
  const [comparisonStatus, setComparisonStatus] = useState<ComparisonStatus>('off');
  const [qualityExpanded, setQualityExpanded] = useState(false);
  const [artworkSort, setArtworkSort] = useState<ArtworkSortKey>('views');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sourceSort, setSourceSort] = useState<AttributionSortKey>('views');
  const [campaignSort, setCampaignSort] = useState<AttributionSortKey>('views');
  const [contentSort, setContentSort] = useState<AttributionSortKey>('views');
  const [campaignSourceFilter, setCampaignSourceFilter] = useState('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [showCampaignWithoutName, setShowCampaignWithoutName] = useState(false);
  const [showAllCampaignRows, setShowAllCampaignRows] = useState(false);
  const [contentSourceFilter, setContentSourceFilter] = useState('all');
  const [contentCampaignFilter, setContentCampaignFilter] = useState('all');
  const [contentSearch, setContentSearch] = useState('');
  const [showContentWithoutName, setShowContentWithoutName] = useState(false);
  const [showAllContentRows, setShowAllContentRows] = useState(false);
  const [campaignLabelFilter, setCampaignLabelFilter] = useState<LabelFilterMode>('all');
  const [contentLabelFilter, setContentLabelFilter] = useState<LabelFilterMode>('all');
  const [labelModal, setLabelModal] = useState<LabelModalState | null>(null);
  const [labelModalSaving, setLabelModalSaving] = useState(false);
  const [labelModalError, setLabelModalError] = useState<string | null>(null);
  const [analyticsSection, setAnalyticsSection] = useState<'inkflow' | 'member_growth' | 'meta_ads'>('inkflow');
  const [copiedUtmKey, setCopiedUtmKey] = useState<string | null>(null);
  const [trendMetrics, setTrendMetrics] = useState<Record<TrendMetric, boolean>>({
    views: true,
    favAdds: true,
    uniqueContactSessions: true,
  });
  const requestSeqRef = useRef(0);
  const hasLoadedDataRef = useRef(false);
  const campaignSectionRef = useRef<HTMLDivElement | null>(null);
  const contentSectionRef = useRef<HTMLDivElement | null>(null);

  const validationMessage = useMemo(() => getValidationMessage(startDate, endDate), [startDate, endDate]);
  const comparisonValidationMessage = useMemo(
    () => getComparisonValidationMessage(compareMode, customComparisonStart, customComparisonEnd),
    [compareMode, customComparisonStart, customComparisonEnd]
  );
  const granularity = useMemo(() => resolveGranularity(startDate, endDate), [startDate, endDate]);
  const isDateInvalid = Boolean(validationMessage);
  const isComparisonDateInvalid = compareMode === 'custom' && Boolean(comparisonValidationMessage);
  const compareActive = compareMode !== 'none';
  const previousPeriod = useMemo(() => getPreviousPeriod(startDate, endDate), [startDate, endDate]);
  const comparisonDisplayPeriod = useMemo(() => {
    if (comparisonMeta) {
      return { startDate: comparisonMeta.comparisonStart, endDate: comparisonMeta.comparisonEnd };
    }
    if (compareMode === 'custom') {
      return { startDate: customComparisonStart, endDate: customComparisonEnd };
    }
    return previousPeriod;
  }, [comparisonMeta, compareMode, customComparisonStart, customComparisonEnd, previousPeriod]);
  const comparisonValueLabel = compareMode === 'previous' ? '前期' : '比較期';

  const resolveCoverageComparisonStatus = useCallback((currentCoverage: AnalyticsV2Response['coverage']['status'], previousCoverage: AnalyticsV2Response['coverage']['status']): ComparisonStatus => {
    if (currentCoverage === 'complete' && previousCoverage === 'complete') return 'ready';
    if (currentCoverage === 'unavailable' || previousCoverage === 'unavailable') return 'unavailable';
    return 'partial';
  }, []);

  const loadData = useCallback(async () => {
    const validation = getValidationMessage(startDate, endDate);
    const comparisonValidation = getComparisonValidationMessage(compareMode, customComparisonStart, customComparisonEnd);
    if (validation || (compareMode === 'custom' && comparisonValidation)) {
      requestSeqRef.current += 1;
      setRequestError(null);
      setComparisonRequestError(compareMode === 'custom' && comparisonValidation ? comparisonValidation : null);
      setComparisonStatus('off');
      setIsLoading(false);
      setIsRefreshing(false);
      debugRequest({ requestId: requestSeqRef.current, status: 'validation_blocked', validation, comparisonValidation });
      return;
    }

    const seq = ++requestSeqRef.current;
    setRequestError(null);
    setComparisonRequestError(null);
    if (!hasLoadedDataRef.current) setIsLoading(true);
    else setIsRefreshing(true);
    if (!compareActive) {
      setComparisonStatus('off');
      setComparisonPeriod(null);
      setComparisonMeta(null);
    } else {
      setComparisonStatus('loading');
    }
    debugRequest({ requestId: seq, status: 'start', startDate, endDate, granularity, compareMode });

    try {
      const currentResult = normalizeAnalyticsV2Response(await db.getAnalyticsV2({
        startDate,
        endDate,
        granularity,
        compareMode,
        comparisonStart: compareMode === 'custom' ? customComparisonStart : undefined,
        comparisonEnd: compareMode === 'custom' ? customComparisonEnd : undefined,
      }));
      if (seq !== requestSeqRef.current) return;
      setData(currentResult);
      setRequestError(null);
      hasLoadedDataRef.current = true;
      debugRequest({ requestId: seq, status: 'success', coverage: currentResult.coverage?.status });

      if (compareActive) {
        if (currentResult.comparison) {
          setComparisonPeriod(currentResult.comparison);
          setComparisonMeta(currentResult.comparisonMeta ?? null);
          setComparisonRequestError(null);
          setComparisonStatus(resolveCoverageComparisonStatus(
            currentResult.coverage.status,
            currentResult.comparison.coverage.status
          ));
        } else {
          setComparisonPeriod(null);
          setComparisonMeta(null);
          setComparisonStatus('error');
          setComparisonRequestError('比較期間資料載入失敗');
        }
      }
    } catch (error) {
      if (seq !== requestSeqRef.current) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        debugRequest({ requestId: seq, status: 'aborted' });
        return;
      }
      const message = '分析資料載入失敗，請稍後再試。';
      setRequestError(message);
      setComparisonStatus('off');
      setComparisonPeriod(null);
      setComparisonMeta(null);
      debugRequest({ requestId: seq, status: 'error', error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (seq === requestSeqRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [compareActive, compareMode, customComparisonEnd, customComparisonStart, endDate, granularity, resolveCoverageComparisonStatus, startDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyPreset = (preset: DatePresetKey) => {
    const range = getPresetDateRange(preset);
    setSelectedPreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const onCustomDateChange = (nextStart: string, nextEnd: string) => {
    setSelectedPreset('custom');
    setStartDate(nextStart);
    setEndDate(nextEnd);
  };

  const summary = data?.summary ?? {
    views: 0,
    favAdds: 0,
    favRemoves: 0,
    netFavorites: 0,
    contacts: 0,
    lineContacts: 0,
    instagramContacts: 0,
    favoriteRate: 0,
    contactRate: 0,
    uniqueViewSessions: 0,
    uniqueFavoriteSessions: 0,
    uniqueContactSessions: 0,
    sessionFavoriteRate: 0,
    sessionContactRate: 0,
  };
  const previousSummary = comparisonPeriod?.summary ?? summary;
  const previousFunnel = comparisonPeriod?.funnel ?? normalizeAnalyticsFunnel(null);
  const funnel = data?.funnel ?? normalizeAnalyticsFunnel(null);
  const channelLeads = data?.channelLeads ?? normalizeAnalyticsChannelLeads(null);
  const booking = normalizeAnalyticsBooking(data?.booking, funnel.totalSessions);
  const previousBooking = normalizeAnalyticsBooking(comparisonPeriod?.booking, previousFunnel.totalSessions);

  const trendItems: TrendChartItem[] = useMemo(
    () => (data?.trend ?? []).map((point) => ({
      label: getTrendLabel(point, granularity),
      views: point.views,
      favAdds: point.favAdds,
      uniqueContactSessions: point.uniqueContactSessions,
    })),
    [data?.trend, granularity]
  );

  const qualityWarning = useMemo(() => {
    if (!data) return false;
    const q = data.quality;
    return q.incompleteEventsAfterV2Start > 0
      || q.missingSessionEvents > 0
      || q.missingEventIdEvents > 0
      || q.contactMissingChannel > 0
      || q.contactMissingValue > 0;
  }, [data]);

  const filteredArtworkRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const rows = (data?.byArtwork ?? []).filter((row) => {
      if (!keyword) return true;
      return row.title.toLowerCase().includes(keyword) || row.artworkId.toLowerCase().includes(keyword);
    });
    const sorted = [...rows].sort((a, b) => {
      const valueA = a[artworkSort];
      const valueB = b[artworkSort];
      if (valueA === valueB) return b.views - a.views;
      return valueB - valueA;
    });
    return sorted;
  }, [artworkSort, data?.byArtwork, searchKeyword]);

  const sourceRows = useMemo(() => sortSourceRows(data?.bySource ?? [], sourceSort), [data?.bySource, sourceSort]);

  const sourceOptions = useMemo(() => {
    const keys = new Set((data?.bySource ?? []).map((row) => row.source));
    return ['all', ...Array.from(keys)];
  }, [data?.bySource]);

  const filteredCampaignRows = useMemo(() => {
    let rows = [...(data?.byCampaign ?? [])];
    if (campaignSourceFilter !== 'all') {
      rows = rows.filter((row) => sourcesMatchNormalizedFilter(row.source, campaignSourceFilter));
    }
    if (!showCampaignWithoutName) {
      rows = rows.filter((row) => row.campaign !== null && String(row.campaign).trim() !== '');
    }
    const keyword = campaignSearch.trim().toLowerCase();
    if (keyword) {
      rows = rows.filter((row) => {
        const raw = (row.campaign ?? '').toLowerCase();
        const labeled = (row.displayName ?? '').toLowerCase();
        return raw.includes(keyword) || labeled.includes(keyword);
      });
    }
    if (campaignLabelFilter === 'unlabeled') {
      rows = rows.filter((row) => !row.isLabeled);
    }
    return sortAttributionRows(rows, campaignSort);
  }, [campaignLabelFilter, campaignSearch, campaignSort, campaignSourceFilter, data?.byCampaign, showCampaignWithoutName]);

  const availableCampaignForContent = useMemo(() => {
    let rows = [...(data?.byContent ?? [])];
    if (contentSourceFilter !== 'all') {
      rows = rows.filter((row) => sourcesMatchNormalizedFilter(row.source, contentSourceFilter));
    }
    const names = new Set(rows.map((row) => row.campaign ?? ''));
    return ['all', ...Array.from(names)];
  }, [contentSourceFilter, data?.byContent]);

  const filteredContentRows = useMemo(() => {
    let rows = [...(data?.byContent ?? [])];
    if (contentSourceFilter !== 'all') {
      rows = rows.filter((row) => sourcesMatchNormalizedFilter(row.source, contentSourceFilter));
    }
    if (contentCampaignFilter !== 'all') {
      rows = rows.filter((row) => (row.campaign ?? '') === contentCampaignFilter);
    }
    if (!showContentWithoutName) {
      rows = rows.filter((row) => row.content !== null && String(row.content).trim() !== '');
    }
    const keyword = contentSearch.trim().toLowerCase();
    if (keyword) {
      rows = rows.filter((row) => {
        const raw = (row.content ?? '').toLowerCase();
        const labeled = (row.displayName ?? '').toLowerCase();
        return raw.includes(keyword) || labeled.includes(keyword);
      });
    }
    if (contentLabelFilter === 'unlabeled') {
      rows = rows.filter((row) => !row.isLabeled);
    }
    return sortAttributionRows(rows, contentSort);
  }, [
    contentCampaignFilter,
    contentLabelFilter,
    contentSearch,
    contentSort,
    contentSourceFilter,
    data?.byContent,
    showContentWithoutName,
  ]);

  const displayedCampaignRows = useMemo(
    () => (showAllCampaignRows ? filteredCampaignRows : filteredCampaignRows.slice(0, 20)),
    [filteredCampaignRows, showAllCampaignRows]
  );
  const displayedContentRows = useMemo(
    () => (showAllContentRows ? filteredContentRows : filteredContentRows.slice(0, 20)),
    [filteredContentRows, showAllContentRows]
  );

  const previousSourceMap = useMemo(() => {
    const map = new Map<string, AnalyticsV2SourceRow>();
    (comparisonPeriod?.bySource ?? []).forEach((row) => map.set(makeSourceKey(row.source), row));
    return map;
  }, [comparisonPeriod]);
  const previousCampaignMap = useMemo(() => {
    const map = new Map<string, AnalyticsV2CampaignRow>();
    (comparisonPeriod?.byCampaign ?? []).forEach((row) => map.set(makeCampaignKey(row.source, row.campaign), row));
    return map;
  }, [comparisonPeriod]);
  const previousContentMap = useMemo(() => {
    const map = new Map<string, AnalyticsV2ContentRow>();
    (comparisonPeriod?.byContent ?? []).forEach((row) => map.set(makeContentKey(row.source, row.campaign, row.content), row));
    return map;
  }, [comparisonPeriod]);
  const previousArtworkMap = useMemo(() => {
    const map = new Map<string, AnalyticsV2ArtworkRow>();
    (comparisonPeriod?.byArtwork ?? []).forEach((row) => map.set(row.artworkId, row));
    return map;
  }, [comparisonPeriod]);

  const contentTagContext = useMemo(
    () => buildContentTagContext(data?.byContent ?? [], summary.sessionContactRate),
    [data?.byContent, summary.sessionContactRate]
  );

  const bestSource = useMemo(() => findBestPerformer(data?.bySource ?? []), [data?.bySource]);
  const bestCampaign = useMemo(() => findBestPerformer(data?.byCampaign ?? []), [data?.byCampaign]);
  const bestContent = useMemo(() => findBestPerformer(data?.byContent ?? []), [data?.byContent]);

  const isUnavailableCoverage = !isDateInvalid && data?.coverage.status === 'unavailable';
  const isPartialCoverage = !isDateInvalid && data?.coverage.status === 'partial';
  const isEmptyData = !isUnavailableCoverage && summary.views === 0 && summary.contacts === 0 && filteredArtworkRows.length === 0;
  const showAttributionComparison = compareActive && comparisonStatus === 'ready';

  const handleCompareModeChange = (mode: AnalyticsCompareMode) => {
    setCompareMode(mode);
    if (mode === 'custom') {
      const prev = getPreviousPeriod(startDate, endDate);
      setCustomComparisonStart((current) => current || prev.startDate);
      setCustomComparisonEnd((current) => current || prev.endDate);
    }
  };

  const handleDrillToCampaign = (source: string) => {
    setCampaignSourceFilter(source);
    campaignSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDrillToContent = (source: string, campaign: string | null) => {
    setContentSourceFilter(source);
    setContentCampaignFilter(campaign ?? '');
    contentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopyUtm = async (key: string, payload: string) => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedUtmKey(key);
      window.setTimeout(() => {
        setCopiedUtmKey((prev) => (prev === key ? null : prev));
      }, 1400);
    } catch {
      // ignore clipboard failure
    }
  };

  const openLabelModal = (
    dimension: AnalyticsLabelDimension,
    rawValue: string,
    row: AnalyticsV2SourceRow | AnalyticsV2CampaignRow | AnalyticsV2ContentRow
  ) => {
    setLabelModalError(null);
    setLabelModal({
      dimension,
      rawValue,
      displayName: row.isLabeled && row.displayName ? row.displayName : getAnalyticsPrimaryName(dimension, row),
      note: row.note ?? '',
      isLabeled: row.isLabeled ?? false,
    });
  };

  const closeLabelModal = () => {
    if (labelModalSaving) return;
    setLabelModal(null);
    setLabelModalError(null);
  };

  const handleSaveLabel = async () => {
    if (!labelModal) return;
    const displayName = labelModal.displayName.trim();
    if (!displayName) {
      setLabelModalError('請輸入顯示名稱。');
      return;
    }
    setLabelModalSaving(true);
    setLabelModalError(null);
    try {
      const saved = await db.upsertAnalyticsLabel({
        dimension: labelModal.dimension,
        rawValue: labelModal.rawValue,
        displayName,
        note: labelModal.note.trim(),
      });
      const fields: AnalyticsLabelFields = {
        displayName: saved.displayName,
        note: saved.note,
        isLabeled: true,
      };
      setData((prev) => (prev ? patchAnalyticsLabelFields(prev, labelModal.dimension, labelModal.rawValue, fields) : prev));
      setComparisonPeriod((prev) => (prev ? patchPeriodLabelFields(prev, labelModal.dimension, labelModal.rawValue, fields) : prev));
      setLabelModal((prev) => (prev ? { ...prev, displayName: saved.displayName, note: saved.note ?? '', isLabeled: true } : prev));
      setLabelModal(null);
    } catch {
      setLabelModalError('儲存失敗，請稍後再試。');
    } finally {
      setLabelModalSaving(false);
    }
  };

  const handleDeleteLabel = async () => {
    if (!labelModal || !labelModal.isLabeled) return;
    setLabelModalSaving(true);
    setLabelModalError(null);
    try {
      await db.deleteAnalyticsLabel({
        dimension: labelModal.dimension,
        rawValue: labelModal.rawValue,
      });
      const fields: AnalyticsLabelFields = {
        displayName: labelModal.rawValue === '' ? null : labelModal.rawValue,
        note: null,
        isLabeled: false,
      };
      setData((prev) => (prev ? patchAnalyticsLabelFields(prev, labelModal.dimension, labelModal.rawValue, fields) : prev));
      setComparisonPeriod((prev) => (prev ? patchPeriodLabelFields(prev, labelModal.dimension, labelModal.rawValue, fields) : prev));
      setLabelModal(null);
    } catch {
      setLabelModalError('刪除失敗，請稍後再試。');
    } finally {
      setLabelModalSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAnalyticsSection('inkflow')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            analyticsSection === 'inkflow' ? 'bg-primary text-black' : 'bg-black/30 text-gray-300 hover:text-white'
          }`}
        >
          網站分析
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsSection('member_growth')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            analyticsSection === 'member_growth' ? 'bg-primary text-black' : 'bg-black/30 text-gray-300 hover:text-white'
          }`}
        >
          會員成長
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsSection('meta_ads')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            analyticsSection === 'meta_ads' ? 'bg-primary text-black' : 'bg-black/30 text-gray-300 hover:text-white'
          }`}
        >
          Meta 廣告資料
        </button>
      </div>

      {analyticsSection === 'meta_ads' ? (
        <MetaAdsImportPanel />
      ) : analyticsSection === 'member_growth' ? (
        <MemberGrowthPanel />
      ) : (
      <>
      <div className="bg-card rounded-xl p-4 border border-white/5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_OPTIONS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedPreset === preset.key ? 'bg-primary text-black' : 'bg-black/30 text-gray-300 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            selectedPreset === 'custom' ? 'bg-primary text-black' : 'bg-black/30 text-gray-300'
          }`}>
            自訂日期
          </span>
        </div>

        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="text-sm text-gray-300">
            開始日期
            <input
              type="date"
              value={startDate}
              onChange={(e) => onCustomDateChange(e.target.value, endDate)}
              className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-gray-300">
            結束日期
            <input
              type="date"
              value={endDate}
              onChange={(e) => onCustomDateChange(startDate, e.target.value)}
              className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
            />
          </label>
          <button
            onClick={() => loadData()}
            disabled={isLoading || isRefreshing}
            className="h-10 px-4 rounded-lg border border-white/15 text-sm text-gray-200 hover:text-white disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={14} className={isLoading || isRefreshing ? 'animate-spin' : ''} />
            重新整理
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span>台北今日：{getTaipeiToday()}</span>
          <span>自動粒度：{granularity === 'daily' ? '每日' : granularity === 'weekly' ? '每週' : '每月'}</span>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-300">比較方式</p>
          <div className="inline-flex rounded-lg border border-white/10 overflow-hidden text-sm">
            {([
              { key: 'none' as const, label: '不比較' },
              { key: 'previous' as const, label: '上一期間' },
              { key: 'custom' as const, label: '自訂期間' },
            ]).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => handleCompareModeChange(option.key)}
                className={`px-3 py-2 ${compareMode === option.key ? 'bg-primary text-black' : 'bg-black/30 text-gray-300 hover:text-white'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {compareMode === 'custom' && (
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm text-gray-300">
              Comparison Start Date
              <input
                type="date"
                value={customComparisonStart}
                onChange={(e) => setCustomComparisonStart(e.target.value)}
                className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
              />
            </label>
            <label className="text-sm text-gray-300">
              Comparison End Date
              <input
                type="date"
                value={customComparisonEnd}
                onChange={(e) => setCustomComparisonEnd(e.target.value)}
                className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
              />
            </label>
          </div>
        )}

        {compareActive && !isDateInvalid && !isComparisonDateInvalid && (
          <div className="text-xs text-gray-400 space-y-1">
            <p>目前期間：{toShortDate(startDate)} ～ {toShortDate(endDate)}</p>
            <p>
              比較期間：{toShortDate(comparisonDisplayPeriod.startDate)} ～ {toShortDate(comparisonDisplayPeriod.endDate)}
              {compareMode === 'previous' && '（等長上一期間）'}
              {compareMode === 'custom' && '（自訂）'}
            </p>
          </div>
        )}

        {comparisonValidationMessage && (
          <div className="rounded-lg bg-red-900/25 border border-red-700/40 px-3 py-2 text-sm text-red-200">
            {comparisonValidationMessage}
          </div>
        )}

        {validationMessage && (
          <div className="rounded-lg bg-red-900/25 border border-red-700/40 px-3 py-2 text-sm text-red-200">
            {validationMessage}
          </div>
        )}

        {!isDateInvalid && isPartialCoverage && data && (
          <div className="rounded-lg bg-yellow-900/20 border border-yellow-700/35 px-3 py-2 text-sm text-yellow-200">
            Analytics V2 完整追蹤自 {toTaipeiDateTimeText(data.coverage.analyticsV2StartAt)} 起開始。較早日期的來源、Session 與詢問資料不完整，本頁轉換指標僅計算完整追蹤期間。預約轉換僅統計 Booking Tracking 上線後資料。
          </div>
        )}
        {!isDateInvalid && isUnavailableCoverage && data && (
          <div className="rounded-lg bg-amber-900/20 border border-amber-700/35 px-3 py-2 text-sm text-amber-200">
            此日期區間尚未啟用 Analytics V2 完整追蹤。完整資料自 {toTaipeiDateTimeText(data.coverage.analyticsV2StartAt)} 起開始。
          </div>
        )}

        {qualityWarning && data && (
          <div className="rounded-lg bg-orange-900/20 border border-orange-700/35 px-3 py-2 text-sm text-orange-200">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><AlertTriangle size={15} /> 偵測到部分分析事件資料不完整</span>
              <button
                onClick={() => setQualityExpanded((prev) => !prev)}
                className="text-xs underline underline-offset-2"
              >
                {qualityExpanded ? '收合詳情' : '查看詳情'}
              </button>
            </div>
            {qualityExpanded && (
              <div className="mt-2 text-xs text-orange-100 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                <p>不完整事件：{toNumber(data.quality.incompleteEventsAfterV2Start)}</p>
                <p>缺少 Session：{toNumber(data.quality.missingSessionEvents)}</p>
                <p>缺少事件 ID：{toNumber(data.quality.missingEventIdEvents)}</p>
                <p>詢問缺少來源管道：{toNumber(data.quality.contactMissingChannel)}</p>
                <p>詢問缺少價格：{toNumber(data.quality.contactMissingValue)}</p>
              </div>
            )}
          </div>
        )}

        {requestError && data && !isDateInvalid && (
          <div className="rounded-lg bg-red-900/25 border border-red-700/40 px-3 py-2 text-sm text-red-200">
            {requestError}
          </div>
        )}

        {compareActive && comparisonRequestError && !isDateInvalid && !requestError && (
          <div className="rounded-lg bg-red-900/20 border border-red-700/30 px-3 py-2 text-sm text-red-200">
            {comparisonRequestError}
          </div>
        )}

        {compareActive && !isDateInvalid && !isComparisonDateInvalid && !requestError && (
          <div className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-gray-300">
            {comparisonStatus === 'loading' && '比較資料載入中…'}
            {comparisonStatus === 'ready' && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-gray-400">與前期相比</span>
                <span className={getComparisonToneClass(calculateCountChange(funnel.totalSessions, previousFunnel.totalSessions))}>追蹤 Session {formatComparisonChange(calculateCountChange(funnel.totalSessions, previousFunnel.totalSessions))}</span>
                <span className={getComparisonToneClass(calculateCountChange(funnel.viewSessions, previousFunnel.viewSessions))}>查看 Session {formatComparisonChange(calculateCountChange(funnel.viewSessions, previousFunnel.viewSessions))}</span>
                <span className={getComparisonToneClass(calculateCountChange(funnel.leadSessions, previousFunnel.leadSessions))}>Lead Session {formatComparisonChange(calculateCountChange(funnel.leadSessions, previousFunnel.leadSessions))}</span>
                <span className={getComparisonToneClass(calculateCountChange(summary.views, previousSummary.views))}>瀏覽 {formatComparisonChange(calculateCountChange(summary.views, previousSummary.views))}</span>
                <span className={getComparisonToneClass(calculateCountChange(summary.favAdds, previousSummary.favAdds))}>收藏 {formatComparisonChange(calculateCountChange(summary.favAdds, previousSummary.favAdds))}</span>
                <span className={getComparisonToneClass(calculateCountChange(summary.lineContacts, previousSummary.lineContacts))}>LINE {formatComparisonChange(calculateCountChange(summary.lineContacts, previousSummary.lineContacts))}</span>
                <span className={getComparisonToneClass(calculateCountChange(summary.instagramContacts, previousSummary.instagramContacts))}>IG {formatComparisonChange(calculateCountChange(summary.instagramContacts, previousSummary.instagramContacts))}</span>
                <span className={getComparisonToneClass(calculateRatePointChange(funnel.leadConversionRate, previousFunnel.leadConversionRate))}>Lead Rate {formatComparisonChange(calculateRatePointChange(funnel.leadConversionRate, previousFunnel.leadConversionRate))}</span>
                <span className={getComparisonToneClass(calculateRatePointChange(funnel.viewToLeadRate, previousFunnel.viewToLeadRate))}>View→Lead {formatComparisonChange(calculateRatePointChange(funnel.viewToLeadRate, previousFunnel.viewToLeadRate))}</span>
                <span className={getComparisonToneClass(calculateCountChange(booking.completeSessions, previousBooking.completeSessions))}>完成預約 {formatComparisonChange(calculateCountChange(booking.completeSessions, previousBooking.completeSessions))}</span>
                <span className={getComparisonToneClass(calculateRatePointChange(booking.bookingConversionRate, previousBooking.bookingConversionRate))}>預約轉換率 {formatComparisonChange(calculateRatePointChange(booking.bookingConversionRate, previousBooking.bookingConversionRate))}</span>
              </div>
            )}
            {comparisonStatus === 'partial' && '比較期間僅有部分完整追蹤資料，因此不顯示變化百分比。'}
            {comparisonStatus === 'unavailable' && '比較期間早於 Analytics V2 完整追蹤起始時間，暫無可比較資料。'}
            {comparisonStatus === 'error' && '比較期間資料載入失敗。'}
          </div>
        )}
      </div>

      {isLoading && !data ? (
        <div className="py-24 text-center">
          <RefreshCw size={28} className="animate-spin text-primary mx-auto mb-3" />
          <p className="text-gray-500 text-sm">載入 Analytics V2 資料中...</p>
        </div>
      ) : !data ? (
        <div className="py-24 text-center space-y-3">
          {isDateInvalid ? (
            <p className="text-gray-400">請先修正日期條件以查看分析資料。</p>
          ) : (
            <>
              <p className="text-gray-400">{requestError ?? '分析資料載入失敗，請稍後再試。'}</p>
              <button
                onClick={() => loadData()}
                className="px-4 py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:text-white"
              >
                重新整理
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={`relative space-y-5 ${isDateInvalid ? 'opacity-60' : ''}`}>
          {isRefreshing && (
            <div className="absolute inset-0 z-20 bg-black/35 backdrop-blur-[1px] rounded-xl flex items-start justify-end p-4 pointer-events-none">
              <div className="flex items-center gap-2 text-xs text-gray-200">
                <RefreshCw size={13} className="animate-spin" />
                更新中...
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1">瀏覽</p>
              <p className="text-3xl font-bold text-blue-400">{toNumber(summary.views)}</p>
              <p className="text-[11px] text-gray-500 mt-1">View events</p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={summary.views}
                previousValue={previousSummary.views}
                kind="count"
                comparisonLabel={comparisonValueLabel}
              />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1">收藏</p>
              <p className="text-3xl font-bold text-pink-400">{toNumber(summary.favAdds)}</p>
              <p className="text-[11px] text-gray-500 mt-1">Session 收藏率 {toPercent(summary.sessionFavoriteRate)}</p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={summary.favAdds}
                previousValue={previousSummary.favAdds}
                kind="count"
                comparisonLabel={comparisonValueLabel}
              />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">詢問 <span title="至少發生一次 LINE 或 Instagram 聯絡的瀏覽 Session 數。"><Info size={12} /></span></p>
              <p className="text-3xl font-bold text-primary">{toNumber(summary.uniqueContactSessions)}</p>
              <p className="text-[11px] text-gray-500 mt-1">Contact events：{toNumber(summary.contacts)}</p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={summary.uniqueContactSessions}
                previousValue={previousSummary.uniqueContactSessions}
                kind="count"
                comparisonLabel={comparisonValueLabel}
              />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">詢問率 <span title="有發生聯絡的 Session ÷ 有瀏覽作品的 Session。"><Info size={12} /></span></p>
              <p className="text-3xl font-bold text-white">{toPercent(summary.sessionContactRate)}</p>
              <p className="text-[11px] text-gray-500 mt-1">聯絡事件 / 瀏覽：{toPercent(summary.contactRate)}</p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={summary.sessionContactRate}
                previousValue={previousSummary.sessionContactRate}
                kind="rate"
                formatValue={(value) => toPercent(value, 1)}
                comparisonLabel={comparisonValueLabel}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <CalendarDays size={13} /> 完成預約 Sessions
              </p>
              <p className="text-3xl font-bold text-emerald-400">{toNumber(booking.completeSessions)}</p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={booking.completeSessions}
                previousValue={previousBooking.completeSessions}
                kind="count"
                comparisonLabel={comparisonValueLabel}
              />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                預約轉換率 <span title="完成預約 Session ÷ 追蹤 Session。"><Info size={12} /></span>
              </p>
              <p className="text-3xl font-bold text-white">{toPercent(booking.bookingConversionRate)}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Booking Start {toNumber(booking.startSessions)} · Start → Complete {toPercent(booking.startToCompleteRate, 1)}
              </p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={booking.bookingConversionRate}
                previousValue={previousBooking.bookingConversionRate}
                kind="rate"
                formatValue={(value) => toPercent(value, 1)}
                comparisonLabel={comparisonValueLabel}
              />
            </div>
          </div>

          {!isUnavailableCoverage && (
            <ConversionFunnelPanel
              funnel={funnel}
              channelLeads={channelLeads}
              compareActive={compareActive && !isDateInvalid}
              comparisonStatus={comparisonStatus}
              previousFunnel={showAttributionComparison ? previousFunnel : undefined}
              comparisonLabel={comparisonValueLabel}
            />
          )}

          {!isUnavailableCoverage && (
            <BookingFunnelPanel
              booking={booking}
              compareActive={compareActive && !isDateInvalid}
              comparisonStatus={comparisonStatus}
              previousBooking={showAttributionComparison ? previousBooking : undefined}
              comparisonLabel={comparisonValueLabel}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><MessageCircle size={13} /> LINE</p>
              <p className="text-2xl font-bold text-white">{toNumber(summary.lineContacts)}</p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={summary.lineContacts}
                previousValue={previousSummary.lineContacts}
                kind="count"
                comparisonLabel={comparisonValueLabel}
              />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Instagram size={13} /> Instagram</p>
              <p className="text-2xl font-bold text-white">{toNumber(summary.instagramContacts)}</p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={summary.instagramContacts}
                previousValue={previousSummary.instagramContacts}
                kind="count"
                comparisonLabel={comparisonValueLabel}
              />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Heart size={13} /> 淨收藏</p>
              <p className={`text-2xl font-bold ${summary.netFavorites >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {summary.netFavorites >= 0 ? '+' : ''}{toNumber(summary.netFavorites)}
              </p>
              <ComparisonLineBlock
                enabled={compareActive && !isDateInvalid}
                status={comparisonStatus}
                currentValue={summary.netFavorites}
                previousValue={previousSummary.netFavorites}
                kind="absolute"
                formatValue={(value) => `${value >= 0 ? '+' : ''}${toNumber(value)}`}
                comparisonLabel={comparisonValueLabel}
              />
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border border-white/5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-white">
                {granularity === 'daily' ? '每日趨勢' : granularity === 'weekly' ? '每週趨勢' : '每月趨勢'}（目前期間）
              </h3>
              <div className="flex items-center gap-2 text-xs">
                {([
                  { key: 'views', label: '瀏覽', activeClass: 'bg-blue-900/50 text-blue-300 border-blue-700/40' },
                  { key: 'favAdds', label: '收藏', activeClass: 'bg-pink-900/50 text-pink-300 border-pink-700/40' },
                  { key: 'uniqueContactSessions', label: '詢問', activeClass: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/40' },
                ] as Array<{ key: TrendMetric; label: string; activeClass: string }>).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTrendMetrics((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={`px-2.5 py-1 rounded-md border ${
                      trendMetrics[item.key]
                        ? item.activeClass
                        : 'border-white/10 text-gray-500'
                    }`}
                  >
                    {trendMetrics[item.key] ? '☑' : '☐'} {item.label}
                  </button>
                ))}
              </div>
            </div>
            <TrendBarChart data={trendItems} enabledMetrics={trendMetrics} />
          </div>

          <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex flex-wrap items-center gap-3 justify-between">
              <h3 className="font-bold text-white">各作品分析</h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-400">排序</label>
                <select
                  value={artworkSort}
                  onChange={(e) => setArtworkSort(e.target.value as ArtworkSortKey)}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                >
                  <option value="views">瀏覽最多</option>
                  <option value="favAdds">收藏最多</option>
                  <option value="lineContacts">LINE最多</option>
                  <option value="instagramContacts">IG最多</option>
                  <option value="uniqueContactSessions">詢問 Session 最多</option>
                  <option value="sessionContactRate">詢問率最高</option>
                  <option value="viewSessions">View Sessions 最多</option>
                  <option value="leadSessions">Lead Sessions 最多</option>
                  <option value="viewToLeadRate">View → Lead 最高</option>
                  <option value="bookingStartSessions">Booking Start 最多</option>
                  <option value="bookingCompleteSessions">Booking Complete 最多</option>
                  <option value="bookingRate">Booking Rate 最高</option>
                </select>
                <label className="relative">
                  <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="搜尋作品名稱或ID"
                    className="pl-7 pr-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-sm text-white"
                  />
                </label>
              </div>
            </div>

            {isUnavailableCoverage ? (
              <div className="py-16 text-center text-gray-400">
                <p>此日期區間尚未啟用 Analytics V2 完整追蹤。</p>
                <p className="text-xs mt-2 text-gray-500">完整資料自 {toTaipeiDateTimeText(data.coverage.analyticsV2StartAt)} 起開始。</p>
              </div>
            ) : isEmptyData ? (
              <div className="py-16 text-center text-gray-400">
                <p>此期間尚無分析資料。</p>
              </div>
            ) : filteredArtworkRows.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p>找不到符合搜尋條件的作品。</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1480px] text-left">
                  <thead className="bg-dark text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-3 w-10">#</th>
                      <th className="px-3 py-3 w-12">縮圖</th>
                      <th className="px-3 py-3">作品名稱</th>
                      <th className="px-3 py-3 text-center">瀏覽</th>
                      <th className="px-3 py-3 text-center">View Sess.</th>
                      <th className="px-3 py-3 text-center">Lead Sess.</th>
                      <th className="px-3 py-3 text-center">View→Lead</th>
                      <th className="px-3 py-3 text-center">Bk Start</th>
                      <th className="px-3 py-3 text-center">Bk Complete</th>
                      <th className="px-3 py-3 text-center">Bk Rate</th>
                      <th className="px-3 py-3 text-center">收藏</th>
                      <th className="px-3 py-3 text-center">LINE</th>
                      <th className="px-3 py-3 text-center">IG</th>
                      <th className="px-3 py-3 text-center">詢問Session</th>
                      <th className="px-3 py-3 text-center">詢問率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredArtworkRows.map((row, idx) => {
                      const previousArtwork = previousArtworkMap.get(row.artworkId);
                      return (
                      <tr key={row.artworkId} className="hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2 text-xs text-gray-500">#{idx + 1}</td>
                        <td className="px-3 py-2">
                          {row.imageUrl ? (
                            <img src={row.imageUrl} alt="" className="w-10 h-10 rounded object-cover bg-gray-800" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-800" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-sm text-white font-medium max-w-[220px] truncate">{row.title || row.artworkId}</p>
                          <p className="text-xs text-gray-500">{row.artworkId}</p>
                        </td>
                        <td className="px-3 py-2 text-center text-blue-300">{toNumber(row.views)}</td>
                        <td className="px-3 py-2 text-center text-gray-200">
                          <p>{toNumber(row.viewSessions)}</p>
                          <ComparisonMetricBlock
                            enabled={compareActive && !isDateInvalid}
                            status={comparisonStatus}
                            current={row.viewSessions}
                            previous={previousArtwork?.viewSessions}
                            kind="count"
                            comparisonLabel={comparisonValueLabel}
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-primary">
                          <p>{toNumber(row.leadSessions)}</p>
                          <ComparisonMetricBlock
                            enabled={compareActive && !isDateInvalid}
                            status={comparisonStatus}
                            current={row.leadSessions}
                            previous={previousArtwork?.leadSessions}
                            kind="count"
                            comparisonLabel={comparisonValueLabel}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <span className="text-white">{toPercent(row.viewToLeadRate, 2)}</span>
                            <LowSampleBadge sessions={row.viewSessions} />
                          </div>
                          <ComparisonMetricBlock
                            enabled={compareActive && !isDateInvalid}
                            status={comparisonStatus}
                            current={row.viewToLeadRate}
                            previous={previousArtwork?.viewToLeadRate}
                            kind="rate"
                            formatValue={(v) => toPercent(v, 2)}
                            comparisonLabel={comparisonValueLabel}
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-emerald-300">
                          <p>{toNumber(row.bookingStartSessions)}</p>
                          <ComparisonMetricBlock
                            enabled={compareActive && !isDateInvalid}
                            status={comparisonStatus}
                            current={row.bookingStartSessions}
                            previous={previousArtwork?.bookingStartSessions}
                            kind="count"
                            comparisonLabel={comparisonValueLabel}
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-emerald-200">
                          <p>{toNumber(row.bookingCompleteSessions)}</p>
                          <ComparisonMetricBlock
                            enabled={compareActive && !isDateInvalid}
                            status={comparisonStatus}
                            current={row.bookingCompleteSessions}
                            previous={previousArtwork?.bookingCompleteSessions}
                            kind="count"
                            comparisonLabel={comparisonValueLabel}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <span className="text-white">{toPercent(row.bookingRate, 2)}</span>
                            <LowSampleBadge sessions={row.viewSessions} />
                          </div>
                          <ComparisonMetricBlock
                            enabled={compareActive && !isDateInvalid}
                            status={comparisonStatus}
                            current={row.bookingRate}
                            previous={previousArtwork?.bookingRate}
                            kind="rate"
                            formatValue={(v) => toPercent(v, 2)}
                            comparisonLabel={comparisonValueLabel}
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-pink-300">{toNumber(row.favAdds)}</td>
                        <td className="px-3 py-2 text-center text-gray-200">{toNumber(row.lineContacts)}</td>
                        <td className="px-3 py-2 text-center text-gray-200">{toNumber(row.instagramContacts)}</td>
                        <td className="px-3 py-2 text-center text-primary">{toNumber(row.uniqueContactSessions)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <span className="text-white">{toPercent(row.sessionContactRate, 2)}</span>
                            {row.uniqueViewSessions < ANALYTICS_MIN_SAMPLE_SESSIONS && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-700/30">
                                樣本少
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-white">流量與廣告</h3>
              {isPartialCoverage && (
                <p className="text-xs text-yellow-300">僅統計 Analytics V2 完整追蹤期間</p>
              )}
            </div>

            {isUnavailableCoverage ? (
              <div className="bg-card rounded-xl border border-white/5 p-6 text-sm text-gray-300">
                此期間尚無完整來源分析資料。
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { title: '最佳來源', result: bestSource, name: bestSource.winner ? getAnalyticsPrimaryName('source', bestSource.winner) : null },
                    {
                      title: '最佳 Campaign',
                      result: bestCampaign,
                      name: bestCampaign.winner ? `${getSourcePresentation(bestCampaign.winner.source).label} / ${getAnalyticsPrimaryName('campaign', bestCampaign.winner)}` : null,
                    },
                    {
                      title: '最佳廣告素材',
                      result: bestContent,
                      name: bestContent.winner ? `${getSourcePresentation(bestContent.winner.source).label} / ${getAnalyticsPrimaryName('campaign', bestContent.winner)} / ${getAnalyticsPrimaryName('content', bestContent.winner)}` : null,
                    },
                  ].map((item) => (
                    <div key={item.title} className="bg-card rounded-xl border border-white/5 p-4">
                      <p className="text-xs text-gray-500 mb-1">{item.title}</p>
                      {item.result.winner ? (
                        <>
                          <p className="text-sm text-white font-semibold truncate">{item.name}</p>
                          <p className="text-xs text-gray-400 mt-1">Lead Rate {toPercent(item.result.winner.leadRate ?? item.result.winner.sessionContactRate, 2)} / Lead Sessions {toNumber(item.result.winner.leadSessions ?? item.result.winner.uniqueContactSessions)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">{item.result.insufficientSample ? '資料量不足' : '—'}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex flex-wrap items-center gap-2 justify-between">
                    <h4 className="font-bold text-white">Source 總覽</h4>
                    <AttributionSortSelect value={sourceSort} onChange={setSourceSort} />
                  </div>
                  <SourceAttributionList
                    rows={sourceRows}
                    compareActive={compareActive && !isDateInvalid}
                    comparisonStatus={comparisonStatus}
                    getPrevious={(row) => previousSourceMap.get(makeSourceKey(row.source))}
                    onDrillCampaign={handleDrillToCampaign}
                    renderNameCell={(row) => {
                      const sourceInfo = getSourcePresentation(row.source);
                      return (
                        <>
                          <AnalyticsLabelNameCell
                            dimension="source"
                            row={row}
                            onEdit={() => openLabelModal('source', toAnalyticsLabelRawValue('source', getSourceLabelRawValue(row)), row)}
                          />
                          {!sourceInfo.isKnown && <span className="text-[10px] text-amber-300 border border-amber-700/40 rounded px-1.5 py-0.5 mt-1 inline-block">未識別來源</span>}
                          {sourceInfo.isDirect && <p className="text-[10px] text-gray-500 mt-0.5">未取得UTM來源的流量</p>}
                        </>
                      );
                    }}
                  />
                </div>

                <div ref={campaignSectionRef} className="bg-card rounded-xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/10 space-y-3">
                    <h4 className="font-bold text-white">Campaign 分析</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={campaignSourceFilter}
                        onChange={(e) => setCampaignSourceFilter(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                      >
                        {sourceOptions.map((option) => (
                          <option key={`campaign-source-${option}`} value={option}>
                            {option === 'all' ? '全部來源' : getNormalizedSourceDisplay(option)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={campaignSearch}
                        onChange={(e) => setCampaignSearch(e.target.value)}
                        placeholder="搜尋 Campaign"
                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                      />
                      <label className="text-xs text-gray-400 inline-flex items-center gap-1">
                        <input type="checkbox" checked={showCampaignWithoutName} onChange={(e) => setShowCampaignWithoutName(e.target.checked)} />
                        顯示無Campaign流量
                      </label>
                      <LabelFilterToggle value={campaignLabelFilter} onChange={setCampaignLabelFilter} />
                      <AttributionSortSelect value={campaignSort} onChange={setCampaignSort} />
                    </div>
                  </div>
                  {filteredCampaignRows.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm">此期間沒有帶 Campaign 標記的流量。</div>
                  ) : (
                    <CampaignAttributionList
                      rows={displayedCampaignRows}
                      compareActive={compareActive && !isDateInvalid}
                      comparisonStatus={comparisonStatus}
                      getPrevious={(row) => previousCampaignMap.get(makeCampaignKey(row.source, row.campaign))}
                      getSourceLabel={(source) => getSourcePresentation(source).label}
                      onDrillContent={handleDrillToContent}
                      onCopyUtm={handleCopyUtm}
                      copiedUtmKey={copiedUtmKey}
                      renderNameCell={(row) => (
                        <AnalyticsLabelNameCell
                          dimension="campaign"
                          row={row}
                          onEdit={() => openLabelModal('campaign', toAnalyticsLabelRawValue('campaign', row.campaign), row)}
                        />
                      )}
                    />
                  )}
                  {filteredCampaignRows.length > 20 && (
                    <div className="p-3 border-t border-white/10">
                      <button
                        onClick={() => setShowAllCampaignRows((prev) => !prev)}
                        className="text-xs text-primary hover:underline"
                      >
                        {showAllCampaignRows ? '只顯示前20筆' : `顯示全部（${filteredCampaignRows.length}）`}
                      </button>
                    </div>
                  )}
                </div>

                <div ref={contentSectionRef} className="bg-card rounded-xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/10 space-y-3">
                    <h4 className="font-bold text-white">Content / 廣告素材分析</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={contentSourceFilter}
                        onChange={(e) => {
                          setContentSourceFilter(e.target.value);
                          setContentCampaignFilter('all');
                        }}
                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                      >
                        {sourceOptions.map((option) => (
                          <option key={`content-source-${option}`} value={option}>
                            {option === 'all' ? '全部來源' : getNormalizedSourceDisplay(option)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={contentCampaignFilter}
                        onChange={(e) => setContentCampaignFilter(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                      >
                        {availableCampaignForContent.map((campaignOption) => (
                          <option key={`content-campaign-${campaignOption || 'empty'}`} value={campaignOption}>
                            {campaignOption === 'all' ? '全部 Campaign' : toCampaignDisplayName(campaignOption || null)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={contentSearch}
                        onChange={(e) => setContentSearch(e.target.value)}
                        placeholder="搜尋 Content"
                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                      />
                      <label className="text-xs text-gray-400 inline-flex items-center gap-1">
                        <input type="checkbox" checked={showContentWithoutName} onChange={(e) => setShowContentWithoutName(e.target.checked)} />
                        顯示未設定Content
                      </label>
                      <LabelFilterToggle value={contentLabelFilter} onChange={setContentLabelFilter} />
                      <AttributionSortSelect value={contentSort} onChange={setContentSort} />
                    </div>
                  </div>
                  {filteredContentRows.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm">此期間沒有帶 Content 標記的流量。</div>
                  ) : (
                    <ContentAttributionList
                      rows={displayedContentRows}
                      compareActive={compareActive && !isDateInvalid}
                      comparisonStatus={comparisonStatus}
                      getPrevious={(row) => previousContentMap.get(makeContentKey(row.source, row.campaign, row.content))}
                      getSourceLabel={(source) => getSourcePresentation(source).label}
                      getCampaignLabel={(row) => getAnalyticsPrimaryName('campaign', row)}
                      onCopyUtm={handleCopyUtm}
                      copiedUtmKey={copiedUtmKey}
                      renderTags={(row) => {
                        const tags = getContentPerformanceTags(row, contentTagContext);
                        return (
                          <div className="flex flex-wrap gap-1">
                            {isFunnelLowSample(row.sessions) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-700/30">樣本較少</span>
                            )}
                            {tags.includes('low_sample') && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-700/30">樣本少</span>
                            )}
                            {tags.includes('high_potential') && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-700/30">高潛力</span>
                            )}
                            {tags.includes('high_traffic_low_inquiry') && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/30"
                                title="曝光相對高，但詢問率低於整體平均。"
                              >
                                高瀏覽低詢問
                              </span>
                            )}
                          </div>
                        );
                      }}
                      renderNameCell={(row) => (
                        <AnalyticsLabelNameCell
                          dimension="content"
                          row={row}
                          onEdit={() => openLabelModal('content', toAnalyticsLabelRawValue('content', row.content), row)}
                        />
                      )}
                    />
                  )}
                  {filteredContentRows.length > 20 && (
                    <div className="p-3 border-t border-white/10">
                      <button
                        onClick={() => setShowAllContentRows((prev) => !prev)}
                        className="text-xs text-primary hover:underline"
                      >
                        {showAllContentRows ? '只顯示前20筆' : `顯示全部（${filteredContentRows.length}）`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      </>
      )}

      {labelModal && analyticsSection === 'inkflow' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">
                {labelModal.isLabeled ? '編輯命名' : '新增命名'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">{DIMENSION_LABELS[labelModal.dimension]} 手動命名</p>
            </div>

            <label className="block text-sm text-gray-300">
              原始值
              <input
                readOnly
                value={labelModal.rawValue === '' ? '(未設定)' : labelModal.rawValue}
                className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-3 py-2 text-gray-400 cursor-not-allowed"
              />
            </label>

            <label className="block text-sm text-gray-300">
              顯示名稱
              <input
                value={labelModal.displayName}
                onChange={(e) => setLabelModal((prev) => (prev ? { ...prev, displayName: e.target.value } : prev))}
                maxLength={120}
                className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
                placeholder="例如：牡丹認領圖 A"
              />
            </label>

            <label className="block text-sm text-gray-300">
              備註
              <textarea
                value={labelModal.note}
                onChange={(e) => setLabelModal((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
                maxLength={500}
                rows={3}
                className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white resize-none"
                placeholder="選填"
              />
            </label>

            {labelModalError && (
              <p className="text-sm text-red-400">{labelModalError}</p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              {labelModal.isLabeled ? (
                <button
                  type="button"
                  onClick={handleDeleteLabel}
                  disabled={labelModalSaving}
                  className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  刪除命名
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeLabelModal}
                  disabled={labelModalSaving}
                  className="px-4 py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:text-white disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveLabel}
                  disabled={labelModalSaving}
                  className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50"
                >
                  {labelModalSaving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;
