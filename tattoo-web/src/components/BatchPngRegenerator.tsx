import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Play, RotateCcw, Square, X } from 'lucide-react';
import { db } from '../services/mockBackend';
import type { AdminContextBrand, Artwork } from '../types';
import { compressPngForUpload } from '../utils/compressPngForUpload';
import { resolvePublicAssetUrl } from '../utils/publicAssetUrl';
import {
  formatRemoveBgPresetSummary,
  generateTransparentPng,
  type RemoveBgPreset,
} from '../utils/removeBackgroundPreset';
import {
  buildArtworkPngUpdatePayload,
  filterArtworksForBatch,
  type BatchPngScope,
} from '../utils/artworkPngBatch';

/** 每件之間稍作停頓，避免短時間大量請求觸發 Cloudflare 防護 */
const DELAY_BETWEEN_ITEMS_MS = 400;

type ItemStatus = 'pending' | 'running' | 'done' | 'color' | 'failed' | 'skipped' | 'reverted';

interface BatchItem {
  artwork: Artwork;
  status: ItemStatus;
  oldPngUrl: string;
  newPngUrl?: string;
  error?: string;
}

const SCOPE_OPTIONS: Array<{ value: BatchPngScope; label: string }> = [
  { value: 'all', label: '全部作品' },
  { value: 'with_png', label: '只處理已有 PNG 的' },
  { value: 'missing_png', label: '只處理缺 PNG 的' },
];

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: '等待中',
  running: '處理中…',
  done: '完成',
  color: '完成（彩色，保留原色）',
  failed: '失敗',
  skipped: '已略過',
  reverted: '已復原',
};

const STATUS_CLASS: Record<ItemStatus, string> = {
  pending: 'text-gray-500',
  running: 'text-primary',
  done: 'text-emerald-400',
  color: 'text-amber-300',
  failed: 'text-red-400',
  skipped: 'text-gray-500',
  reverted: 'text-sky-300',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Props {
  open: boolean;
  onClose: () => void;
  artworks: Artwork[];
  preset: RemoveBgPreset;
  isSystemDefaultPreset: boolean;
  currentAdminBrand: AdminContextBrand | null;
  onFinished: () => void;
}

const BatchPngRegenerator: React.FC<Props> = ({
  open,
  onClose,
  artworks,
  preset,
  isSystemDefaultPreset,
  currentAdminBrand,
  onFinished,
}) => {
  const [scope, setScope] = useState<BatchPngScope>('all');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [phase, setPhase] = useState<'select' | 'running' | 'finished' | 'reverting'>('select');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const stopRequestedRef = useRef(false);

  const isBusyNow = phase === 'running' || phase === 'reverting';
  useEffect(() => {
    if (!isBusyNow) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isBusyNow]);

  const candidates = useMemo(() => filterArtworksForBatch(artworks, scope), [artworks, scope]);
  const selected = candidates.filter((a) => !excludedIds.has(a.id));

  const updateItem = (id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((item) => (item.artwork.id === id ? { ...item, ...patch } : item)));
  };

  const counts = useMemo(() => {
    const c: Record<ItemStatus, number> = { pending: 0, running: 0, done: 0, color: 0, failed: 0, skipped: 0, reverted: 0 };
    items.forEach((item) => { c[item.status] += 1; });
    return c;
  }, [items]);
  const processedCount = counts.done + counts.color + counts.failed + counts.skipped;

  const toggleOne = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setAll = (checked: boolean) => {
    setExcludedIds(checked ? new Set() : new Set(candidates.map((a) => a.id)));
  };

  const runBatch = async () => {
    if (selected.length === 0) return;
    const ok = window.confirm(
      `即將用目前的去背預設，重新產生 ${selected.length} 件作品的透明 PNG，並更新到正式網站。\n\n` +
      '作品其他資料（標題、價格、標籤、部位等）不會變動。舊的 PNG 檔仍保留在主機上，完成後可以按「復原這一批」換回來。\n\n確定開始？'
    );
    if (!ok) return;

    // 開始前重新抓一次最新作品資料，避免用到過期內容覆蓋
    let fresh: Artwork[];
    try {
      fresh = await db.getAdminArtworks();
    } catch (e) {
      console.error(e);
      alert('讀取最新作品資料失敗，請稍後再試。');
      return;
    }
    const freshById = new Map(fresh.map((a) => [a.id, a]));
    const queue: BatchItem[] = selected
      .map((a) => freshById.get(a.id))
      .filter((a): a is Artwork => Boolean(a))
      .map((artwork) => ({ artwork, status: 'pending' as ItemStatus, oldPngUrl: artwork.pngUrl || '' }));

    setItems(queue);
    setPhase('running');
    stopRequestedRef.current = false;

    for (let i = 0; i < queue.length; i += 1) {
      const { artwork } = queue[i];
      if (stopRequestedRef.current) {
        for (let j = i; j < queue.length; j += 1) updateItem(queue[j].artwork.id, { status: 'skipped' });
        break;
      }
      updateItem(artwork.id, { status: 'running' });
      try {
        const coverUrl = (artwork.imageUrls && artwork.imageUrls[0]) || artwork.imageUrl;
        const source = resolvePublicAssetUrl(coverUrl, currentAdminBrand) || coverUrl;
        const result = await generateTransparentPng(source, preset);
        const pngFile = new File([result.blob], 'generated-preview.png', { type: 'image/png' });
        const compressed = await compressPngForUpload(pngFile);
        const newPngUrl = await db.uploadPngFile(compressed.blob);
        await db.saveArtwork(buildArtworkPngUpdatePayload(artwork, newPngUrl));
        updateItem(artwork.id, { status: result.colorDetected ? 'color' : 'done', newPngUrl });
      } catch (e) {
        console.error('Batch PNG failed', artwork.id, e);
        updateItem(artwork.id, { status: 'failed', error: e instanceof Error ? e.message : '未知錯誤' });
      }
      if (i < queue.length - 1) await sleep(DELAY_BETWEEN_ITEMS_MS);
    }

    setPhase('finished');
    onFinished();
  };

  const revertBatch = async () => {
    const targets = items.filter((item) => (item.status === 'done' || item.status === 'color') && item.newPngUrl);
    if (targets.length === 0) return;
    if (!window.confirm(`要把這一批 ${targets.length} 件作品的 PNG 換回處理前的版本嗎？`)) return;

    setPhase('reverting');
    let fresh: Artwork[] = [];
    try {
      fresh = await db.getAdminArtworks();
    } catch (e) {
      console.error(e);
      alert('讀取最新作品資料失敗，請稍後再試。');
      setPhase('finished');
      return;
    }
    const freshById = new Map(fresh.map((a) => [a.id, a]));

    for (const item of targets) {
      const current = freshById.get(item.artwork.id);
      if (!current) continue;
      // 若處理後又被手動改過 PNG，就不覆蓋
      if ((current.pngUrl || '') !== item.newPngUrl) {
        updateItem(item.artwork.id, { error: '處理後 PNG 已被修改，未復原' });
        continue;
      }
      try {
        await db.saveArtwork(buildArtworkPngUpdatePayload(current, item.oldPngUrl || undefined));
        updateItem(item.artwork.id, { status: 'reverted' });
      } catch (e) {
        updateItem(item.artwork.id, { error: `復原失敗：${e instanceof Error ? e.message : '未知錯誤'}` });
      }
      await sleep(DELAY_BETWEEN_ITEMS_MS);
    }
    setPhase('finished');
    onFinished();
  };

  const handleClose = () => {
    if (phase === 'running' || phase === 'reverting') return;
    setItems([]);
    setPhase('select');
    setExcludedIds(new Set());
    onClose();
  };

  if (!open) return null;

  const isBusy = phase === 'running' || phase === 'reverting';
  const progressTotal = items.length || 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Layers size={18} className="text-primary" /> 批次重新產生透明 PNG
          </h3>
          <button type="button" onClick={handleClose} disabled={isBusy} className="text-gray-400 hover:text-white disabled:opacity-30">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 border-b border-white/10 text-sm">
          <p className="text-gray-400">
            使用去背預設：
            <span className="text-white">{formatRemoveBgPresetSummary(preset, { isSystemDefault: isSystemDefaultPreset })}</span>
          </p>
          <p className="text-xs text-gray-500">
            只會替換作品的透明 PNG，其他資料不變。若要調整效果，請先到「自動去背」頁儲存預設。
          </p>

          {phase === 'select' && (
            <div className="flex flex-wrap gap-2">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setScope(option.value); setExcludedIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    scope === option.value
                      ? 'bg-primary/15 border-primary text-primary'
                      : 'bg-dark border-white/10 text-gray-300 hover:border-white/20'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {phase !== 'select' && (
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round((processedCount / progressTotal) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {processedCount} / {items.length}
                {' · '}<span className="text-emerald-400">完成 {counts.done}</span>
                {counts.color > 0 && <>{' · '}<span className="text-amber-300">彩色保留原色 {counts.color}</span></>}
                {counts.failed > 0 && <>{' · '}<span className="text-red-400">失敗 {counts.failed}</span></>}
                {counts.skipped > 0 && <>{' · '}略過 {counts.skipped}</>}
                {counts.reverted > 0 && <>{' · '}<span className="text-sky-300">已復原 {counts.reverted}</span></>}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {phase === 'select' ? (
            <>
              <label className="flex items-center gap-2 text-xs text-gray-400 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selected.length === candidates.length && candidates.length > 0}
                  onChange={(e) => setAll(e.target.checked)}
                />
                全選（已選 {selected.length} / {candidates.length} 件）
              </label>
              <ul className="divide-y divide-white/5">
                {candidates.map((art) => (
                  <li key={art.id} className="py-1.5">
                    <label className="flex items-center gap-3 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={!excludedIds.has(art.id)}
                        onChange={() => toggleOne(art.id)}
                      />
                      <span className="text-gray-200 truncate flex-1">{art.title || art.id}</span>
                      <span className="text-xs text-gray-500 shrink-0">{art.pngUrl ? '已有 PNG' : '缺 PNG'}</span>
                    </label>
                  </li>
                ))}
                {candidates.length === 0 && <li className="py-6 text-center text-gray-500 text-sm">沒有符合的作品</li>}
              </ul>
            </>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((item) => (
                <li key={item.artwork.id} className="py-1.5 text-sm flex items-start gap-3">
                  <span className="text-gray-200 truncate flex-1">{item.artwork.title || item.artwork.id}</span>
                  <span className={`text-xs shrink-0 text-right ${STATUS_CLASS[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                    {item.error && <span className="block text-red-400">{item.error}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex flex-wrap gap-2 justify-end">
          {phase === 'select' && (
            <button
              type="button"
              onClick={runBatch}
              disabled={selected.length === 0}
              className="bg-primary text-black font-bold px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2 text-sm"
            >
              <Play size={16} /> 開始處理 {selected.length} 件
            </button>
          )}
          {phase === 'running' && (
            <button
              type="button"
              onClick={() => { stopRequestedRef.current = true; }}
              className="bg-card border border-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2 text-sm"
            >
              <Square size={14} /> 處理完目前這件後停止
            </button>
          )}
          {phase === 'finished' && (
            <>
              {counts.done + counts.color > 0 && (
                <button
                  type="button"
                  onClick={revertBatch}
                  className="bg-card border border-white/20 text-gray-200 px-4 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2 text-sm"
                >
                  <RotateCcw size={14} /> 復原這一批
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="bg-primary text-black font-bold px-4 py-2 rounded-lg hover:bg-primary/90 text-sm"
              >
                完成
              </button>
            </>
          )}
          {isBusy && (
            <p className="text-xs text-amber-300/90 w-full text-right">處理中請勿關閉或重新整理此頁</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchPngRegenerator;
