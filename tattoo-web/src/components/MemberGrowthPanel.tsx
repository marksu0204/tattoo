import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Info, RefreshCw, UserPlus, Users, UserMinus, TrendingUp } from 'lucide-react';
import { db } from '../services/mockBackend';
import type { MemberGrowthAnalyticsResponse } from '../types';
import { useAdminBrand } from '../context/AdminBrandContext';
import { ComparisonMetricBlock } from './analytics/ComparisonMetricBlock';
import {
  addDaysToDateString,
  getDateRangeDaysInclusive,
  getPresetDateRange,
  getPreviousPeriod,
  getTaipeiToday,
} from '../utils/taipeiDate';
import { shouldSkipMemberGrowthFetch } from '../utils/memberGrowthFetch';

const MAX_RANGE_DAYS = 366;

type GrowthPresetKey = 'last7' | 'last30' | 'last90' | 'custom';

const PRESET_OPTIONS: Array<{ key: GrowthPresetKey; label: string }> = [
  { key: 'last7', label: '最近7天' },
  { key: 'last30', label: '最近30天' },
  { key: 'last90', label: '最近90天' },
  { key: 'custom', label: '自訂' },
];

const toNumber = (value: number): string => value.toLocaleString('zh-TW');

const toShortDate = (dateString: string): string => {
  const [, m, d] = dateString.split('-');
  return `${Number(m)}/${Number(d)}`;
};

const getGrowthPresetRange = (preset: GrowthPresetKey): { startDate: string; endDate: string } => {
  if (preset === 'last90') {
    const today = getTaipeiToday();
    return { startDate: addDaysToDateString(today, -89), endDate: today };
  }
  if (preset === 'last7') return getPresetDateRange('last7');
  if (preset === 'last30') return getPresetDateRange('last30');
  const today = getTaipeiToday();
  return { startDate: addDaysToDateString(today, -29), endDate: today };
};

const getValidationMessage = (startDate: string, endDate: string): string | null => {
  if (!startDate || !endDate) return '請選擇開始與結束日期。';
  if (startDate > endDate) return '開始日期不可晚於結束日期。';
  if (getDateRangeDaysInclusive(startDate, endDate) > MAX_RANGE_DAYS) return '日期區間最多可查詢 366 天。';
  return null;
};

type TrendMetricKey = 'newUsers' | 'followEvents' | 'unfollowEvents' | 'netFollowEvents';

const TREND_METRICS: Array<{ key: TrendMetricKey; label: string; color: string }> = [
  { key: 'newUsers', label: '新增會員', color: 'bg-emerald-500' },
  { key: 'followEvents', label: 'FOLLOW', color: 'bg-blue-500' },
  { key: 'unfollowEvents', label: 'UNFOLLOW', color: 'bg-orange-500' },
  { key: 'netFollowEvents', label: '好友淨變化', color: 'bg-primary' },
];

const MemberGrowthTrendChart: React.FC<{
  data: MemberGrowthAnalyticsResponse['daily'];
  enabledMetrics: Record<TrendMetricKey, boolean>;
}> = ({ data, enabledMetrics }) => {
  const chartMetrics = TREND_METRICS.filter((m) => enabledMetrics[m.key]);
  const hasAny = chartMetrics.length > 0;
  const chartHeight = 140;
  const maxVal = Math.max(
    1,
    ...data.map((item) => Math.max(
      enabledMetrics.newUsers ? item.newUsers : 0,
      enabledMetrics.followEvents ? item.followEvents : 0,
      enabledMetrics.unfollowEvents ? item.unfollowEvents : 0,
      enabledMetrics.netFollowEvents ? Math.abs(item.netFollowEvents) : 0,
    )),
  );

  if (!data.length) {
    return <div className="h-36 flex items-center justify-center text-gray-500 text-sm">此期間尚無資料。</div>;
  }
  if (!hasAny) {
    return <div className="h-36 flex items-center justify-center text-gray-500 text-sm">請至少選擇一個趨勢指標。</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${Math.max(data.length * 40, 320)}px` }}>
        <div className="flex items-end gap-1 border-b border-white/10" style={{ height: `${chartHeight}px` }}>
          {data.map((item) => (
            <div key={item.date} className="group relative flex flex-1 items-end justify-center gap-0.5">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/90 border border-gray-700 text-white text-xs px-2 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 z-20 pointer-events-none transition-opacity">
                <p className="font-bold text-gray-300 mb-1 text-center">{item.date}</p>
                {enabledMetrics.newUsers && <p className="text-emerald-400">新增會員：{toNumber(item.newUsers)}</p>}
                {enabledMetrics.followEvents && <p className="text-blue-400">FOLLOW：{toNumber(item.followEvents)}</p>}
                {enabledMetrics.unfollowEvents && <p className="text-orange-400">UNFOLLOW：{toNumber(item.unfollowEvents)}</p>}
                {enabledMetrics.netFollowEvents && (
                  <p className="text-primary">淨變化：{item.netFollowEvents >= 0 ? '+' : ''}{toNumber(item.netFollowEvents)}</p>
                )}
              </div>
              {chartMetrics.map((metric) => {
                const raw = item[metric.key];
                const value = metric.key === 'netFollowEvents' ? Math.abs(raw) : raw;
                return (
                  <div
                    key={metric.key}
                    className={`w-2 ${metric.color} rounded-t-sm transition-all`}
                    style={{
                      height: `${(value / maxVal) * chartHeight}px`,
                      minHeight: value !== 0 ? '2px' : '0',
                      opacity: metric.key === 'netFollowEvents' && raw < 0 ? 0.65 : 1,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-1">
          {data.map((item) => (
            <div key={`${item.date}-axis`} className="flex-1 text-center text-[10px] text-gray-500">
              {toShortDate(item.date)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MemberGrowthPanel: React.FC = () => {
  const { brandRevision, status: adminBrandStatus } = useAdminBrand();
  const [preset, setPreset] = useState<GrowthPresetKey>('last30');
  const initialRange = getGrowthPresetRange('last30');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<MemberGrowthAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [trendMetrics, setTrendMetrics] = useState<Record<TrendMetricKey, boolean>>({
    newUsers: true,
    followEvents: true,
    unfollowEvents: true,
    netFollowEvents: true,
  });
  const requestSeqRef = useRef(0);
  const hasLoadedDataRef = useRef(false);

  const validationMessage = useMemo(() => getValidationMessage(startDate, endDate), [startDate, endDate]);
  const isDateInvalid = Boolean(validationMessage);
  const previousPeriod = useMemo(() => getPreviousPeriod(startDate, endDate), [startDate, endDate]);

  const applyPreset = (key: GrowthPresetKey) => {
    setPreset(key);
    if (key !== 'custom') {
      const range = getGrowthPresetRange(key);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  useEffect(() => {
    if (shouldSkipMemberGrowthFetch(adminBrandStatus)) {
      return;
    }

    const validation = getValidationMessage(startDate, endDate);
    if (validation) {
      requestSeqRef.current += 1;
      setRequestError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    if (!hasLoadedDataRef.current) setIsLoading(true);
    else setIsRefreshing(true);
    setRequestError(null);

    void (async () => {
      try {
        const result = await db.getMemberGrowthAnalytics({ startDate, endDate });
        if (seq !== requestSeqRef.current) return;
        setData(result);
        setRequestError(null);
        hasLoadedDataRef.current = true;
      } catch {
        if (seq !== requestSeqRef.current) return;
        setRequestError('會員成長資料載入失敗，請稍後再試。');
      } finally {
        if (seq === requestSeqRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    })();

    return () => {
      requestSeqRef.current += 1;
    };
  }, [adminBrandStatus, brandRevision, endDate, refreshKey, startDate]);

  const handleRefresh = () => {
    setRefreshKey((value) => value + 1);
  };

  const summary = data?.summary;
  const comparison = data?.comparison;

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl p-4 border border-white/5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => applyPreset(option.key)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                preset === option.key
                  ? 'bg-primary text-black border-primary'
                  : 'border-white/10 text-gray-300 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-400">
            開始
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setPreset('custom');
                setStartDate(e.target.value);
              }}
              className="mt-1 block bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="text-xs text-gray-400">
            結束
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setPreset('custom');
                setEndDate(e.target.value);
              }}
              className="mt-1 block bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing || isDateInvalid}
            className="px-3 py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:text-white inline-flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            重新整理
          </button>
        </div>

        <p className="text-xs text-gray-400">
          目前期間：{toShortDate(startDate)} ～ {toShortDate(endDate)} · 比較期間：{toShortDate(previousPeriod.startDate)} ～ {toShortDate(previousPeriod.endDate)}（等長上一期）
        </p>

        {validationMessage && (
          <div className="rounded-lg bg-red-900/25 border border-red-700/40 px-3 py-2 text-sm text-red-200">
            {validationMessage}
          </div>
        )}
        {requestError && !isDateInvalid && (
          <div className="rounded-lg bg-red-900/25 border border-red-700/40 px-3 py-2 text-sm text-red-200">
            {requestError}
          </div>
        )}
      </div>

      {data?.tracking.hasLegacyUsers && (
        <div className="rounded-lg bg-amber-900/20 border border-amber-700/35 px-3 py-2 text-sm text-amber-100">
          <p className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>
              會員成長追蹤從系統啟用後開始統計。啟用前既有會員沒有首次加入日期，因此不會計入新增會員歷史數據。
              <span className="block mt-1 text-amber-200/90">舊會員基準：{toNumber(data.tracking.legacyUsers)}</span>
            </span>
          </p>
        </div>
      )}

      {isLoading && !data ? (
        <div className="py-24 text-center">
          <RefreshCw size={28} className="animate-spin text-primary mx-auto mb-3" />
          <p className="text-gray-500 text-sm">載入會員成長資料中...</p>
        </div>
      ) : !data || !summary || !comparison ? (
        <div className="py-16 text-center text-gray-400">{requestError ?? '尚無資料'}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users size={13} /> 累積會員資料</p>
              <p className="text-3xl font-bold text-white">{toNumber(summary.totalUsers)}</p>
              <p className="text-[11px] text-gray-500 mt-1">含追蹤 {toNumber(summary.trackedUsers)} · 舊基準 {toNumber(summary.legacyUsers)}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><UserPlus size={13} /> 本期新增會員</p>
              <p className="text-3xl font-bold text-white">{toNumber(summary.newUsers)}</p>
              <ComparisonMetricBlock enabled comparisonLabel="前期" status="ready" current={comparison.newUsers.current} previous={comparison.newUsers.previous} kind="count" />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp size={13} /> 加好友事件</p>
              <p className="text-3xl font-bold text-white">{toNumber(summary.followEvents)}</p>
              <ComparisonMetricBlock enabled comparisonLabel="前期" status="ready" current={comparison.followEvents.current} previous={comparison.followEvents.previous} kind="count" />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><UserMinus size={13} /> 取消好友／封鎖</p>
              <p className="text-3xl font-bold text-white">{toNumber(summary.unfollowEvents)}</p>
              <ComparisonMetricBlock enabled comparisonLabel="前期" status="ready" current={comparison.unfollowEvents.current} previous={comparison.unfollowEvents.previous} kind="count" />
            </div>
            <div className="bg-card rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp size={13} /> 好友淨變化</p>
              <p className={`text-3xl font-bold ${summary.netFollowEvents >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {summary.netFollowEvents >= 0 ? '+' : ''}{toNumber(summary.netFollowEvents)}
              </p>
              <ComparisonMetricBlock enabled comparisonLabel="前期" status="ready" current={comparison.netFollowEvents.current} previous={comparison.netFollowEvents.previous} kind="absolute" formatValue={(v) => `${v >= 0 ? '+' : ''}${toNumber(v)}`} />
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border border-white/5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-white">每日趨勢</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {TREND_METRICS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTrendMetrics((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={`px-2.5 py-1 rounded-md border ${
                      trendMetrics[item.key] ? 'border-white/20 text-white' : 'border-white/10 text-gray-500'
                    }`}
                  >
                    {trendMetrics[item.key] ? '☑' : '☐'} {item.label}
                  </button>
                ))}
              </div>
            </div>
            <MemberGrowthTrendChart data={data.daily} enabledMetrics={trendMetrics} />
          </div>
        </>
      )}
    </div>
  );
};

export default MemberGrowthPanel;
