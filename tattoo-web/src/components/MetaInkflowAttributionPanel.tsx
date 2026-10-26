import React, { useCallback, useEffect, useState } from 'react';
import MetaDemographicsPanel from './MetaDemographicsPanel';

import { AlertCircle, ChevronDown, ChevronUp, Download, HelpCircle, Loader, RefreshCw } from 'lucide-react';

import { db } from '../services/mockBackend';

import { logAdminFetchError } from '../utils/adminFetch';

import {

  createAsyncLoadState,

  loadError,

  loadSuccess,

  startLoading,

  type AsyncLoadState,

} from '../utils/asyncLoadState';

import type { MetaInkflowAttributionDailyResponse } from '../types';

import { getPresetDateRange } from '../utils/taipeiDate';



const formatRate = (rate: number | null, notApplicable?: boolean): string => {

  if (notApplicable) return 'N/A';

  if (rate === null) return '—';

  return `${rate.toFixed(1)}%`;

};



const formatLpvSessionRatio = (rate: MetaInkflowAttributionDailyResponse['rows'][0]['rates']['landingToSession']): string => {

  if (rate.notApplicable) return 'N/A';

  if (rate.denominator === 0) return 'N/A';

  if (rate.rate === null) return '—';

  return `${rate.rate.toFixed(1)}%`;

};



const QualityBadge: React.FC<{ label: string; tone: 'exact' | 'fallback' | 'neutral' }> = ({ label, tone }) => {

  const cls =

    tone === 'exact'

      ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50'

      : tone === 'fallback'

        ? 'bg-sky-900/40 text-sky-300 border-sky-800/50'

        : 'bg-gray-800 text-gray-400 border-gray-700';

  return (

    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] leading-none ${cls}`}>

      {label}

    </span>

  );

};



export const MetaInkflowAttributionPanel: React.FC = () => {

  const initial = getPresetDateRange('last30');

  const [dateFrom, setDateFrom] = useState(initial.startDate);

  const [dateTo, setDateTo] = useState(initial.endDate);

  const [attributionLoad, setAttributionLoad] = useState(

    createAsyncLoadState<MetaInkflowAttributionDailyResponse | null>(null)

  );

  const [showUnmatched, setShowUnmatched] = useState(false);

  const [showQualityHelp, setShowQualityHelp] = useState(false);

  const [showExportPanel, setShowExportPanel] = useState(false);

  const [exportDateFrom, setExportDateFrom] = useState(initial.startDate);

  const [exportDateTo, setExportDateTo] = useState(initial.endDate);

  const [exportLoading, setExportLoading] = useState(false);

  const [exportError, setExportError] = useState<string | null>(null);



  const loadAttribution = useCallback(async () => {

    setAttributionLoad((prev) => startLoading(prev));

    try {

      const data = await db.getMetaInkflowAttributionDaily(dateFrom, dateTo);

      setAttributionLoad((prev) => loadSuccess(prev, data));

    } catch (error) {

      logAdminFetchError('getMetaInkflowAttributionDaily', error);

      setAttributionLoad((prev) => loadError(prev, 'Meta × INKFLOW 歸因資料載入失敗'));

    }

  }, [dateFrom, dateTo]);



  const handleExportCsv = async () => {

    setExportLoading(true);

    setExportError(null);

    try {

      await db.exportMetaInkflowAnalysisCsv(exportDateFrom, exportDateTo);

    } catch (error) {

      logAdminFetchError('exportMetaInkflowAnalysisCsv', error);

      setExportError(error instanceof Error ? error.message : 'CSV 匯出失敗');

    } finally {

      setExportLoading(false);

    }

  };



  useEffect(() => {

    loadAttribution();

  }, [loadAttribution]);



  const data = attributionLoad.data;

  const coverage = data?.coverage;



  return (

    <div className="space-y-4 mt-6 pt-6 border-t border-white/10">

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div>

          <h3 className="text-white font-medium">Meta × INKFLOW 歸因檢查</h3>

          <p className="text-xs text-gray-500 mt-1">依 date + ad_id JOIN meta_ad_daily 與 session 事件</p>

        </div>

        <div className="flex flex-wrap items-center gap-3">

          <button

            type="button"

            onClick={() => {

              setExportDateFrom(dateFrom);

              setExportDateTo(dateTo);

              setShowExportPanel((v) => !v);

            }}

            className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"

          >

            <Download size={14} /> 下載廣告分析 CSV

          </button>

          <button

            type="button"

            onClick={loadAttribution}

            className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"

          >

            <RefreshCw size={14} /> 重新載入

          </button>

        </div>

      </div>



      {showExportPanel && (

        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700/80 space-y-3">

          <p className="text-sm text-gray-300 font-medium">匯出廣告分析 CSV</p>

          <p className="text-xs text-gray-500">每列為 date + ad_id，供 ChatGPT 分析 CTR / CPC / 素材成效趨勢。僅含已匯入 Meta CSV 的廣告。日期依 Meta Ads 報表時區。</p>

          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">

            <label className="text-sm text-gray-300">

              開始日期

              <input

                type="date"

                value={exportDateFrom}

                onChange={(e) => setExportDateFrom(e.target.value)}

                className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"

              />

            </label>

            <label className="text-sm text-gray-300">

              結束日期

              <input

                type="date"

                value={exportDateTo}

                onChange={(e) => setExportDateTo(e.target.value)}

                className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"

              />

            </label>

            <button

              type="button"

              onClick={handleExportCsv}

              disabled={exportLoading}

              className="h-10 px-4 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50 flex items-center gap-2"

            >

              {exportLoading ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}

              下載 CSV

            </button>

          </div>

          {exportError && (

            <p className="text-xs text-red-300">{exportError}</p>

          )}

        </div>

      )}



      <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700/80">

        <p className="text-xs text-gray-400 mb-2 font-medium">網站廣告追蹤設定（Meta Ads Manager → URL Parameters）</p>

        <p className="text-sm text-gray-300 mb-2">INKFLOW 需要廣告網址帶入以下參數（使用 Meta 動態值，勿在前端 hardcode）：</p>

        <ul className="text-xs text-gray-400 space-y-1 font-mono">

          <li>meta_campaign_id={'{{campaign.id}}'}</li>

          <li>meta_adset_id={'{{adset.id}}'}</li>

          <li>meta_ad_id={'{{ad.id}}'}</li>

        </ul>

        <p className="text-xs text-gray-500 mt-2">建議同時保留：utm_source、utm_medium、utm_campaign、utm_content</p>

        <p className="text-xs text-gray-500 mt-2">

          測試 URL 範例：

          <span className="block mt-1 text-gray-400 break-all">

            https://inkflow.work/?meta_campaign_id=TEST_CAMPAIGN&amp;meta_adset_id=TEST_ADSET&amp;meta_ad_id=TEST_AD&amp;utm_source=facebook&amp;utm_medium=paid_social#/

          </span>

        </p>

      </div>



      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">

        <p className="sm:col-span-3 text-xs text-gray-500 -mb-1">

          {data?.metaReportTimezone

            ? `日期依 Meta Ads 報表時區（${data.metaReportTimezone}）`

            : '日期依 Meta Ads 報表時區'}

        </p>

        <label className="text-sm text-gray-300">

          開始日期

          <input

            type="date"

            value={dateFrom}

            onChange={(e) => setDateFrom(e.target.value)}

            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"

          />

        </label>

        <label className="text-sm text-gray-300">

          結束日期

          <input

            type="date"

            value={dateTo}

            onChange={(e) => setDateTo(e.target.value)}

            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"

          />

        </label>

        <button

          type="button"

          onClick={loadAttribution}

          disabled={attributionLoad.status === 'loading'}

          className="h-10 px-4 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50"

        >

          查詢

        </button>

      </div>



      {attributionLoad.status === 'loading' && !attributionLoad.hasLoadedOnce ? (

        <div className="flex items-center gap-2 text-gray-400 text-sm py-6">

          <Loader size={16} className="animate-spin" /> 載入歸因資料…

        </div>

      ) : attributionLoad.error && !data ? (

        <div className="rounded-lg border border-red-800/50 bg-red-900/10 p-4 text-sm text-red-300 flex items-center justify-between">

          <span>{attributionLoad.error}</span>

          <button type="button" onClick={loadAttribution} className="text-xs underline">重試</button>

        </div>

      ) : data && coverage ? (

        <>
          {data.demographics && <MetaDemographicsPanel key={`${data.dateFrom}:${data.dateTo}`} data={data.demographics} />}

          {data.timezoneNote && (

            <div className="rounded-lg border border-sky-800/40 bg-sky-900/10 p-3 text-sm text-sky-200 flex items-start gap-2">

              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-sky-400" />

              <span>{data.timezoneNote}</span>

            </div>

          )}



          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">

            <div className="bg-gray-900 rounded-lg p-3">

              <p className="text-xs text-gray-500">全部網站 Sessions</p>

              <p className="text-white font-medium mt-1">{coverage.websiteSessions}</p>

            </div>

            <div className="bg-gray-900 rounded-lg p-3">

              <p className="text-xs text-gray-500">Meta 廣告 Sessions</p>

              <p className="text-white font-medium mt-1">{coverage.metaEligibleSessions}</p>

              <p className="text-[10px] text-gray-600 mt-1">facebook / paid_social / 有 Meta Ad ID</p>

            </div>

            <div className="bg-gray-900 rounded-lg p-3">

              <p className="text-xs text-gray-500">精準歸因</p>

              <p className="text-emerald-400 font-medium mt-1">{coverage.exactSessions}</p>

              <p className="text-[10px] text-gray-500 mt-1">{coverage.exactRate}%</p>

            </div>

            <div className="bg-gray-900 rounded-lg p-3">

              <p className="text-xs text-gray-500">歷史歸因</p>

              <p className="text-sky-400 font-medium mt-1">{coverage.fallbackSessions}</p>

              <p className="text-[10px] text-gray-500 mt-1">{coverage.fallbackRate}%</p>

            </div>

            <div className="bg-gray-900 rounded-lg p-3">

              <p className="text-xs text-gray-500">未歸因</p>

              <p className="text-gray-300 font-medium mt-1">{coverage.unattributedSessions}</p>

              <p className="text-[10px] text-gray-500 mt-1">Coverage {coverage.effectiveAttributionRate}%</p>

            </div>

          </div>



          <button

            type="button"

            onClick={() => setShowQualityHelp((v) => !v)}

            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white"

          >

            <HelpCircle size={14} />

            歸因品質說明

            {showQualityHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}

          </button>



          {showQualityHelp && (

            <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-xs text-gray-400 space-y-2">

              <p><span className="text-emerald-400 font-medium">精準歸因：</span>Session 直接帶入 Meta Ad ID（meta_ad_id）。</p>

              <p><span className="text-sky-400 font-medium">歷史歸因：</span>使用既有 UTM Content 與 Ad ID 精準比對（utm_content = ad_id）。</p>

              <p><span className="text-gray-300 font-medium">未歸因：</span>Meta 廣告流量範圍內，但無足夠資料判斷來源廣告。</p>

              <p className="text-gray-600 pt-1 border-t border-gray-800">

                有效歸因覆蓋率 = (精準 + 歷史) ÷ Meta 廣告 Sessions；精準歸因率 = 精準 ÷ Meta 廣告 Sessions。

                自然流量（direct / LINE / IG 等）不計入 Meta 廣告 Sessions 分母。

              </p>

            </div>

          )}



          <button

            type="button"

            onClick={() => setShowUnmatched((v) => !v)}

            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"

          >

            {showUnmatched ? <ChevronUp size={16} /> : <ChevronDown size={16} />}

            未匹配診斷：Meta 廣告無 Session {data.unmatched.metaAdsWithNoInkflowSessions} · INKFLOW Ad ID 不在 CSV {data.unmatched.inkflowAdIdsNotInCsv}

          </button>



          {showUnmatched && (

            <div className="grid md:grid-cols-2 gap-3 text-xs">

              <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">

                <p className="text-gray-400 mb-2">Meta Ads with no INKFLOW sessions</p>

                {data.unmatched.metaAdsWithNoSessions.length === 0 ? (

                  <p className="text-gray-600">無</p>

                ) : (

                  <ul className="space-y-1 max-h-40 overflow-y-auto">

                    {data.unmatched.metaAdsWithNoSessions.map((item) => (

                      <li key={`${item.date}-${item.adId}`} className="text-gray-300 font-mono">

                        {item.date} · {item.adId} {item.adName ? `(${item.adName})` : ''}

                      </li>

                    ))}

                  </ul>

                )}

              </div>

              <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">

                <p className="text-gray-400 mb-2">INKFLOW Meta Ad IDs not in CSV</p>

                {data.unmatched.inkflowAdIdsNotFound.length === 0 ? (

                  <p className="text-gray-600">無</p>

                ) : (

                  <ul className="space-y-2 max-h-40 overflow-y-auto">

                    {data.unmatched.inkflowAdIdsNotFound.map((item) => (

                      <li key={item.adId} className="text-gray-300">

                        <div className="font-mono">{item.adId} · {item.sessionCount} sessions</div>

                        <div className="flex flex-wrap gap-1 mt-1">

                          {item.attributionQuality === 'EXACT' && <QualityBadge label="精準" tone="exact" />}

                          {item.attributionQuality === 'FALLBACK' && <QualityBadge label="歷史" tone="fallback" />}

                          {item.metaJoinStatus === 'META_NOT_IMPORTED' && (

                            <QualityBadge label="CSV 未匯入" tone="neutral" />

                          )}

                        </div>

                      </li>

                    ))}

                  </ul>

                )}

              </div>

            </div>

          )}



          <div className="overflow-x-auto rounded-lg border border-gray-700">

            <table className="w-full text-xs">

              <thead>

                <tr className="bg-gray-900 text-gray-400 text-left">

                  <th

                    className="p-2 whitespace-nowrap"

                    title={data.metaReportTimezone ? `Meta 報表日期（${data.metaReportTimezone}）` : 'Meta 報表日期'}

                  >

                    日期

                  </th>

                  <th className="p-2 whitespace-nowrap">廣告</th>

                  <th className="p-2 text-right">Meta Click</th>

                  <th className="p-2 text-right">LPV</th>

                  <th className="p-2 text-right">Session</th>

                  <th className="p-2 text-right">

                    <span

                      className="inline-flex items-center gap-1 cursor-help border-b border-dotted border-gray-600"

                      title="Meta Landing Page View 與 INKFLOW Session 定義不同，此數字僅供對照，可能超過 100%。"

                    >

                      Session ÷ LPV

                    </span>

                  </th>

                  <th className="p-2 text-right">View</th>

                  <th className="p-2 text-right">Lead</th>

                  <th className="p-2 text-right">LINE</th>

                  <th className="p-2 text-right">IG</th>

                  <th className="p-2 text-right">BK Start</th>

                  <th className="p-2 text-right">BK Done</th>

                </tr>

              </thead>

              <tbody>

                {data.rows.length === 0 ? (

                  <tr>

                    <td colSpan={12} className="p-6 text-center text-gray-500">此期間尚無可 JOIN 的歸因資料</td>

                  </tr>

                ) : (

                  data.rows.map((row) => {

                    const meta = row.meta;

                    const ink = row.inkflow;

                    const lpvRate = row.rates.landingToSession;

                    return (

                      <tr key={`${row.date}-${row.adId}`} className="border-t border-gray-800 hover:bg-gray-900/40">

                        <td className="p-2 text-gray-300 whitespace-nowrap">{row.date.replace(/-/g, '/')}</td>

                        <td className="p-2 text-gray-300 min-w-[120px]">

                          <div className="font-mono text-[11px]">{row.adId}</div>

                          <div className="text-gray-500 truncate max-w-[160px]">{meta?.adName ?? (row.matched ? '' : '未匯入 CSV')}</div>

                          {meta?.destinationType && meta.destinationType !== 'WEB' && (

                            <span className="text-[10px] text-amber-500">{meta.destinationType}</span>

                          )}

                        </td>

                        <td className="p-2 text-right text-gray-300">{meta?.linkClicks ?? '—'}</td>

                        <td className="p-2 text-right text-gray-300">{meta?.landingPageViews ?? '—'}</td>

                        <td className="p-2 text-right text-white font-medium">

                          <div>{ink.sessions}</div>

                          {(ink.exactSessions > 0 || ink.fallbackSessions > 0) && (

                            <div className="text-[10px] text-gray-500 font-normal mt-0.5 leading-tight">

                              {ink.exactSessions > 0 && <span className="text-emerald-500/80">精準 {ink.exactSessions}</span>}

                              {ink.exactSessions > 0 && ink.fallbackSessions > 0 && ' · '}

                              {ink.fallbackSessions > 0 && <span className="text-sky-500/80">歷史 {ink.fallbackSessions}</span>}

                            </div>

                          )}

                        </td>

                        <td className="p-2 text-right text-gray-400" title="Meta Landing Page View 與 INKFLOW Session 定義不同，此數字僅供對照，可能超過 100%。">

                          {formatLpvSessionRatio(lpvRate)}

                        </td>

                        <td className="p-2 text-right text-gray-300">{ink.viewSessions}</td>

                        <td className="p-2 text-right text-gray-300">{ink.leadSessions}</td>

                        <td className="p-2 text-right text-gray-300">{ink.lineLeadSessions}</td>

                        <td className="p-2 text-right text-gray-300">{ink.igLeadSessions}</td>

                        <td className="p-2 text-right text-gray-300">{ink.bookingStartSessions}</td>

                        <td className="p-2 text-right text-gray-300">{ink.bookingCompleteSessions}</td>

                      </tr>

                    );

                  })

                )}

              </tbody>

            </table>

          </div>

        </>

      ) : null}

    </div>

  );

};



export default MetaInkflowAttributionPanel;


