import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, FileSpreadsheet, Loader, RefreshCw, Upload, X } from 'lucide-react';
import { db } from '../services/mockBackend';
import { logAdminFetchError } from '../utils/adminFetch';
import {
  createAsyncLoadState,
  loadError,
  loadSuccess,
  startLoading,
  type AsyncLoadState,
} from '../utils/asyncLoadState';
import type {
  MetaAdsCsvImportResult,
  MetaAdsCsvPreviewResult,
  MetaAdsImportHistoryItem,
  MetaAdsImportOverview,
} from '../types';
import MetaInkflowAttributionPanel from './MetaInkflowAttributionPanel';

const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatDateRange = (from: string | null, to: string | null): string => {
  if (!from && !to) return '—';
  if (from && to && from !== to) return `${from.replace(/-/g, '/')} ～ ${to.replace(/-/g, '/')}`;
  const d = from || to;
  return d ? d.replace(/-/g, '/') : '—';
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '/');
};

const filterCsvFiles = (fileList: FileList | File[]): File[] => {
  const files = Array.from(fileList);
  const csvOnly = files.filter((f) => f.name.toLowerCase().endsWith('.csv'));
  if (csvOnly.length !== files.length) {
    throw new Error('只接受 .csv 檔案');
  }
  if (csvOnly.length > MAX_FILES) {
    throw new Error(`一次最多上傳 ${MAX_FILES} 個檔案`);
  }
  for (const f of csvOnly) {
    if (f.size > MAX_FILE_SIZE) {
      throw new Error(`「${f.name}」超過 10MB 限制`);
    }
  }
  return csvOnly;
};

export const MetaAdsImportPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<MetaAdsCsvPreviewResult | null>(null);
  const [importResult, setImportResult] = useState<MetaAdsCsvImportResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [overviewLoad, setOverviewLoad] = useState(createAsyncLoadState<MetaAdsImportOverview | null>(null));
  const [historyLoad, setHistoryLoad] = useState(createAsyncLoadState<MetaAdsImportHistoryItem[]>([]));

  const loadOverview = useCallback(async () => {
    setOverviewLoad((prev) => startLoading(prev));
    try {
      const overview = await db.getMetaAdsImportOverview();
      setOverviewLoad((prev) => loadSuccess(prev, overview));
    } catch (error) {
      logAdminFetchError('getMetaAdsImportOverview', error);
      setOverviewLoad((prev) => loadError(prev, 'Meta 廣告資料概覽載入失敗'));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoad((prev) => startLoading(prev));
    try {
      const history = await db.getMetaAdsImportHistory(20);
      setHistoryLoad((prev) => loadSuccess(prev, history));
    } catch (error) {
      logAdminFetchError('getMetaAdsImportHistory', error);
      setHistoryLoad((prev) => loadError(prev, '匯入紀錄載入失敗'));
    }
  }, []);

  useEffect(() => {
    loadOverview();
    loadHistory();
  }, [loadOverview, loadHistory]);

  const handleFileSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setActionError(null);
    setImportResult(null);
    try {
      const files = filterCsvFiles(fileList);
      setSelectedFiles(files);
      setPreviewLoading(true);
      const result = await db.previewMetaAdsCsvImport(files);
      setPreview(result);
    } catch (error) {
      setPreview(null);
      setSelectedFiles([]);
      setActionError(error instanceof Error ? error.message : 'Preview 失敗');
    } finally {
      setPreviewLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setSelectedFiles([]);
    setActionError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFiles.length) return;
    setActionError(null);
    setImportLoading(true);
    try {
      const result = await db.importMetaAdsCsv(selectedFiles);
      setImportResult(result);
      setPreview(null);
      setSelectedFiles([]);
      await Promise.all([loadOverview(), loadHistory()]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '匯入失敗');
    } finally {
      setImportLoading(false);
    }
  };

  const overview = overviewLoad.data;
  const history = historyLoad.data ?? [];

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl p-5 border border-white/5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-primary" />
              Meta 廣告資料
            </h2>
            <p className="text-sm text-gray-400 mt-1">匯入 Meta Ads Manager 每日 × 廣告層級 CSV</p>
          </div>
          <button
            type="button"
            onClick={() => { loadOverview(); loadHistory(); }}
            className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"
          >
            <RefreshCw size={14} /> 重新整理
          </button>
        </div>

        {overviewLoad.status === 'loading' && !overviewLoad.hasLoadedOnce ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-6">
            <Loader size={16} className="animate-spin" /> 載入概覽中…
          </div>
        ) : overviewLoad.error && !overview ? (
          <div className="rounded-lg border border-red-800/50 bg-red-900/10 p-4 text-sm text-red-300 flex items-center justify-between gap-3">
            <span>{overviewLoad.error}</span>
            <button type="button" onClick={loadOverview} className="text-xs underline">重試</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500">目前資料範圍</p>
              <p className="text-white font-medium mt-1">{formatDateRange(overview?.dateFrom ?? null, overview?.dateTo ?? null)}</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500">廣告數</p>
              <p className="text-white font-medium mt-1">{overview?.adCount ?? '—'}</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500">每日廣告紀錄</p>
              <p className="text-white font-medium mt-1">{overview?.dailyRecords ?? 0} 筆</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500">最後匯入</p>
              <p className="text-white font-medium mt-1">{formatDateTime(overview?.lastImportAt ?? null)}</p>
            </div>
          </div>
        )}

        {overview?.dataCompleteness && overview.dataCompleteness.total > 0 && (
          <div className="mb-5">
            <p className="text-xs text-gray-500 mb-2">資料完整度</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
              {([
                ['Spend', overview.dataCompleteness.spend],
                ['Account ID', overview.dataCompleteness.accountId],
                ['Creative ID', overview.dataCompleteness.creativeId],
                ['URL Parameters', overview.dataCompleteness.urlParameters],
              ] as const).map(([label, metric]) => (
                <div key={label} className="bg-gray-900 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-white font-medium mt-0.5">{metric.filled} / {metric.total}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {overview && overview.dailyRecords > 0 && (
          <div className="grid sm:grid-cols-3 gap-3 mb-5 text-sm">
            <div className="text-gray-400">Campaign <span className="text-white ml-1">{overview.campaignCount}</span></div>
            <div className="text-gray-400">Ads <span className="text-white ml-1">{overview.adCount}</span></div>
            <div className="text-gray-400">Daily Records <span className="text-white ml-1">{overview.dailyRecords}</span></div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <button
          type="button"
          disabled={previewLoading || importLoading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-black font-semibold text-sm disabled:opacity-50"
        >
          {previewLoading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
          上傳 Meta CSV
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {importResult && (
        <div className="rounded-xl border border-green-800/50 bg-green-900/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <CheckCircle size={18} />
            Meta 廣告資料匯入完成
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-300">
            <p>檔案：{importResult.fileCount}</p>
            <p>有效資料：{importResult.validRows}</p>
            <p>新增：{importResult.insertedRows}</p>
            <p>更新：{importResult.updatedRows}</p>
            <p>忽略 Meta 總計列：{importResult.ignoredSummaryRows}</p>
            <p>資料範圍：{formatDateRange(importResult.dateFrom, importResult.dateTo)}</p>
          </div>
          {importResult.demographicRows !== undefined && importResult.demographicRows > 0 && (
            <div className="text-xs text-amber-300 space-y-1">
              <p>人口統計明細：新增 {importResult.demographicInserted ?? 0}、更新 {importResult.demographicUpdated ?? 0}。</p>
              <p>canonical Meta 日資料未建立或修改；缺少日資料 {importResult.dailyRecordsMissing ?? 0} 個廣告／日。</p>
              {importResult.demographicQuality?.hasMissingMetrics && <p>資料品質警示：部分人口統計指標為空白，相關加總與比率保留為未知。</p>}
              {importResult.demographicQuality?.detailVsSummaryMismatch && <p>資料品質警示：已知明細加總與檔案總計列不一致。</p>}
            </div>
          )}
          {importResult.errors.length > 0 && (
            <div className="text-xs text-amber-400">
              部分檔案有錯誤：{importResult.errors.map((e) => e.fileName).join('、')}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-white/10 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-white font-medium">偵測完成</h3>
            <button type="button" onClick={handleCancelPreview} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <p className="text-gray-400">匯入模式：<span className="text-white">{preview.importMode === 'DEMOGRAPHIC_META_DAILY' ? 'Demographic（人口統計）' : preview.importMode === 'MIXED' ? '混合報表' : '一般廣告日資料'}</span></p>
            <p className="text-gray-400">檔案：<span className="text-white ml-1">{preview.fileCount}</span></p>
            <p className="text-gray-400">廣告／日組合：{preview.uniqueAdDayRows ?? '—'}</p>
            <p className="text-gray-400">人口統計唯一鍵：{preview.uniqueDemographicRows ?? 0}</p>
            <p className="text-gray-400">行銷活動：{preview.uniqueCampaigns ?? '—'}</p>
            <p className="text-gray-400">年齡：{preview.ageGroups?.join('、') || '—'}</p>
            <p className="text-gray-400">性別：{preview.genderGroups?.join('、') || '—'}</p>
            <p className="text-gray-400">日期範圍：<span className="text-white ml-1">{formatDateRange(preview.dateFrom, preview.dateTo)}</span></p>
            <p className="text-gray-400">總資料列：<span className="text-white ml-1">{preview.totalRows}</span></p>
            <p className="text-gray-400">有效廣告資料：<span className="text-green-400 ml-1">{preview.validRows}</span></p>
            <p className="text-gray-400">忽略總計列：<span className="text-gray-300 ml-1">{preview.ignoredSummaryRows}</span></p>
            <p className="text-gray-400">不同廣告：<span className="text-white ml-1">{preview.uniqueAds}</span></p>
            <p className="text-gray-400">已存在資料：<span className="text-amber-400 ml-1">{preview.existingRows}</span></p>
            <p className="text-gray-400">新資料：<span className="text-primary ml-1">{preview.newRows}</span></p>
            <p className="text-gray-400">格式錯誤：<span className={preview.invalidRows > 0 ? 'text-red-400 ml-1' : 'text-white ml-1'}>{preview.invalidRows}</span></p>
          </div>

          {preview.importMode !== 'STANDARD_META_DAILY' && <div className="text-xs text-amber-300 space-y-1">
            <p>{preview.demographicWarning}</p>
            <p>人口統計匯入不會建立或修改 canonical Meta 日資料。缺少日資料：{preview.dailyRecordsMissing ?? 0} 個廣告／日。</p>
            {preview.demographicQuality?.hasMissingMetrics && <p>偵測到空白人口統計指標；相關總計與比率會保留為未知。</p>}
            {preview.demographicQuality?.detailVsSummaryMismatch && <p>人口統計已知明細加總與檔案總計列不一致；這是資料品質警示，不會阻止匯入。</p>}
            <p>人口統計無效列仍需修正後才能匯入。</p>
          </div>}
          {preview.fileResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {preview.fileResults.map((file) => (
                <div
                  key={file.fileName}
                  className={`text-xs px-3 py-2 rounded-lg border ${
                    file.status === 'error' ? 'border-red-800/50 text-red-300' : 'border-gray-700 text-gray-400'
                  }`}
                >
                  <span className="font-mono">{file.fileName}</span>
                  {file.status === 'error' ? (
                    <span className="ml-2">❌ {file.error}</span>
                  ) : (
                    <span className="ml-2">
                      有效 {file.validRows ?? 0} · 忽略 {file.ignoredSummaryRows ?? 0}
                      {(file.invalidRows ?? 0) > 0 && ` · 錯誤 ${file.invalidRows}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancelPreview}
              disabled={importLoading}
              className="px-4 py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:text-white disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importLoading || preview.validRows === 0 || (preview.importMode !== 'STANDARD_META_DAILY' && (preview.invalidRows > 0 || preview.errors.length > 0))}
              className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {importLoading && <Loader size={14} className="animate-spin" />}
              確認匯入
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl p-5 border border-white/5">
        <h3 className="text-white font-medium mb-4">最近匯入紀錄</h3>

        {historyLoad.status === 'loading' && !historyLoad.hasLoadedOnce ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
            <Loader size={16} className="animate-spin" /> 載入中…
          </div>
        ) : historyLoad.error && history.length === 0 ? (
          <div className="rounded-lg border border-red-800/50 bg-red-900/10 p-4 text-sm text-red-300 flex items-center justify-between">
            <span>{historyLoad.error}</span>
            <button type="button" onClick={loadHistory} className="text-xs underline">重新載入</button>
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-sm">尚無匯入紀錄</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-white font-medium">{formatDateTime(item.importedAt)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.status === 'success' ? 'bg-green-900/30 text-green-400' :
                    item.status === 'partial' ? 'bg-amber-900/30 text-amber-400' :
                    'bg-red-900/30 text-red-400'
                  }`}>
                    {item.status === 'success' ? '成功' : item.status === 'partial' ? '部分成功' : '失敗'}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-gray-400">
                  <p>日期：{formatDateRange(item.dateFrom, item.dateTo)}</p>
                  <p>檔案：{item.fileCount}</p>
                  <p>有效資料：{item.validRows}</p>
                  <p>忽略總計：{item.ignoredSummaryRows}</p>
                  <p>新增：{item.insertedRows}</p>
                  <p>更新：{item.updatedRows}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MetaInkflowAttributionPanel />
    </div>
  );
};

export default MetaAdsImportPanel;
