import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { buildAppOriginUrl } from '../utils/appUrl';
import { logAdminFetchError } from '../utils/adminFetch';
import {
  createAsyncLoadState,
  loadError,
  loadSuccess,
  startLoading,
  type AsyncLoadState,
} from '../utils/asyncLoadState';
import {
  buildLineAudienceSummary,
  loadTestRecipient,
  saveTestRecipient,
  type LineTestRecipient,
} from '../utils/lineAudienceSummary';
import { formatLinkDisplay } from '../utils/lineCarousel';
import {
  blocksToApiPayload,
  createTextBlock,
  messageBlockTypeLabel,
  validateMessageBlocks,
  type MessageBlockState,
} from '../utils/lineBroadcastMessages';
import { LineBroadcastMessageBlocks } from './LineBroadcastMessageBlocks';
import { formatLineSendError } from '../utils/lineSendDebug';
import SafeAvatar from './SafeAvatar';
import type {
  Artwork,
  ArtworkTaxonomyTag,
  LineAudienceFilter,
  LineAudienceLastLoginMode,
  LineAudiencePreviewResponse,
  LineAudienceSummary,
  LineBroadcastSendResult,
  LineBroadcastTestSendResult,
  MemberTag,
} from '../types';
import {
  Send, Users, MessageSquare, ChevronDown, ChevronUp, X,
  CheckCircle, AlertCircle, Eye, Loader, Search, Pencil,
} from 'lucide-react';

const AUDIENCE_DEBOUNCE_MS = 320;

const SelectableChip: React.FC<{
  label: string;
  selected: boolean;
  onClick: () => void;
}> = ({ label, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
      selected
        ? 'bg-primary text-black border-primary'
        : 'bg-gray-800 text-gray-300 border-gray-600 hover:border-gray-500'
    }`}
  >
    {label}
  </button>
);

function buildAudienceFilter(params: {
  mode: 'all' | 'filtered';
  requireFavorites: boolean;
  minFavorites: 0 | 1 | 3 | 5;
  lastLoginMode: LineAudienceLastLoginMode;
  subjectTagIds: number[];
  styleTagIds: number[];
  manualTagIds: number[];
  excludeUserIds: string[];
  excludeTagIds: number[];
}): LineAudienceFilter {
  const filter: LineAudienceFilter = {
    mode: params.mode,
    behavior: {
      requireFavorites: params.requireFavorites,
      minFavorites: params.minFavorites,
      lastLoginMode: params.lastLoginMode,
    },
    interests: {
      subjectTagIds: params.subjectTagIds,
      styleTagIds: params.styleTagIds,
    },
    manualTagIds: params.manualTagIds,
  };
  if (params.excludeUserIds.length > 0 || params.excludeTagIds.length > 0) {
    filter.exclude = {
      userIds: [...params.excludeUserIds],
      tagIds: [...params.excludeTagIds],
    };
  }
  return filter;
}

function toggleChipId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function formatDateTime(iso?: string): string {
  if (!iso) return new Date().toLocaleString('zh-TW');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toLocaleString('zh-TW') : d.toLocaleString('zh-TW');
}

function formatLastLogin(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const AudiencePreviewModal: React.FC<{
  open: boolean;
  onClose: () => void;
  previewState: AsyncLoadState<LineAudiencePreviewResponse | null>;
  onRetry: () => void;
}> = ({ open, onClose, previewState, onRetry }) => {
  if (!open) return null;
  const preview = previewState.data;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h3 className="text-white font-semibold">符合名單預覽</h3>
            {previewState.status === 'success' && preview && (
              <p className="text-gray-400 text-sm mt-0.5">符合條件：{preview.matchedCount} 人（顯示前 {Math.min(50, preview.recipients.length)} 人）</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {previewState.status === 'loading' ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2"><Loader size={18} className="animate-spin" /> 載入中…</div>
          ) : previewState.status === 'error' ? (
            <div className="text-center py-10">
              <p className="text-amber-300 text-sm mb-3">{previewState.error}</p>
              <button type="button" onClick={onRetry} className="text-xs px-3 py-1.5 rounded border border-white/10 text-gray-300 hover:text-white">重新整理</button>
            </div>
          ) : preview && preview.matchedCount === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">目前沒有符合條件的可推播會員</p>
          ) : preview ? (
            <ul className="space-y-3">
              {preview.recipients.map((r) => (
                <li key={r.userId} className="flex gap-3 p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                  <SafeAvatar src={r.pictureUrl} alt={r.displayName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">{r.displayName || '未命名會員'}</p>
                    <p className="text-gray-500 text-xs mt-0.5">收藏：{r.favoriteCount} 件</p>
                    {formatLastLogin(r.lastLogin) && <p className="text-gray-500 text-xs">最近登入：{formatLastLogin(r.lastLogin)}</p>}
                    {r.lineIdMasked && <p className="text-gray-600 text-xs font-mono">LINE ID：{r.lineIdMasked}</p>}
                    {r.matchedTags.length > 0 && <p className="text-primary text-xs mt-1.5">匹配：{r.matchedTags.join('、')}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const AudienceSummaryLines: React.FC<{ summary: LineAudienceSummary; count?: number }> = ({ summary, count }) => (
  <div>
    {count != null && (
      <p className="text-primary font-bold text-lg mb-2">受眾：{count} 人</p>
    )}
    <ul className="space-y-1.5">
      {summary.lines.map((line) => (
        <li key={line.key} className="text-sm text-gray-300 flex items-start gap-2">
          <CheckCircle size={14} className="text-primary flex-shrink-0 mt-0.5" />
          <span>{line.label}</span>
        </li>
      ))}
    </ul>
  </div>
);

const TestRecipientPickerModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (r: LineTestRecipient) => void;
}> = ({ open, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LineTestRecipient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = window.setTimeout(() => {
      db.searchLineEligibleUsers(query, 20)
        .then((rows) => {
          setResults(rows.map((r) => ({
            userId: r.userId,
            displayName: r.displayName,
            lineIdMasked: r.lineIdMasked,
            pictureUrl: r.pictureUrl,
          })));
        })
        .catch((e) => {
          logAdminFetchError('searchLineEligibleUsers', e);
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">選擇測試收件人</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋可推播會員名稱…"
              className="w-full bg-dark border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm"
            />
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-6 flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" /> 搜尋中…</p>
          ) : results.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">找不到可推播會員</p>
          ) : (
            <ul className="space-y-2">
              {results.map((r) => (
                <li key={r.userId}>
                  <button
                    type="button"
                    onClick={() => { onSelect(r); onClose(); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800 border border-gray-700 hover:border-primary/40 text-left"
                  >
                    <SafeAvatar src={r.pictureUrl} alt="" className="w-9 h-9 rounded-full object-cover" iconSize={16} />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{r.displayName}</p>
                      <p className="text-gray-500 text-xs font-mono">LINE ID：{r.lineIdMasked}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const ArtworkPickerModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (artwork: Artwork) => void;
}> = ({ open, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    db.getArtworks()
      .then((rows) => setArtworks(Array.isArray(rows) ? rows : []))
      .catch(() => setArtworks([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artworks.slice(0, 30);
    return artworks.filter((a) =>
      a.title.toLowerCase().includes(q) || String(a.id).includes(q),
    ).slice(0, 30);
  }, [artworks, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">選擇作品</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋作品名稱或 ID…"
            className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          />
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-6">載入中…</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">找不到作品</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(a); onClose(); }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-primary/40 text-left"
                  >
                    {a.imageUrl && <img src={a.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{a.title}</p>
                      <p className="text-gray-500 text-xs">ID: {a.id}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const ExcludeUserPickerModal: React.FC<{
  open: boolean;
  onClose: () => void;
  excludedUserIds: string[];
  onSelect: (r: LineTestRecipient) => void;
}> = ({ open, onClose, excludedUserIds, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LineTestRecipient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = window.setTimeout(() => {
      db.searchLineEligibleUsers(query, 20)
        .then((rows) => {
          setResults(rows
            .filter((r) => !excludedUserIds.includes(r.userId))
            .map((r) => ({
              userId: r.userId,
              displayName: r.displayName,
              lineIdMasked: r.lineIdMasked,
              pictureUrl: r.pictureUrl,
            })));
        })
        .catch((e) => {
          logAdminFetchError('searchLineEligibleUsers', e);
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, query, excludedUserIds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">選擇排除會員</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋會員名稱…"
              className="w-full bg-dark border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm"
            />
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-6 flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" /> 搜尋中…</p>
          ) : results.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">找不到可排除的會員</p>
          ) : (
            <ul className="space-y-2">
              {results.map((r) => (
                <li key={r.userId}>
                  <button
                    type="button"
                    onClick={() => { onSelect(r); onClose(); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800 border border-gray-700 hover:border-red-400/40 text-left"
                  >
                    <SafeAvatar src={r.pictureUrl} alt="" className="w-9 h-9 rounded-full object-cover" iconSize={16} />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{r.displayName}</p>
                      <p className="text-gray-500 text-xs font-mono">LINE ID：{r.lineIdMasked}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const FinalConfirmModal: React.FC<{
  open: boolean;
  onClose: () => void;
  summary: LineAudienceSummary;
  matchedCount: number;
  excludedCount: number;
  finalCount: number;
  title: string;
  messageBlocks: MessageBlockState[];
  trackingUrl: string;
  sending: boolean;
  sendPhase: string;
  audienceChangedMessage: string | null;
  onConfirm: () => void;
}> = ({
  open, onClose, summary, matchedCount, excludedCount, finalCount, title, messageBlocks, trackingUrl,
  sending, sendPhase, audienceChangedMessage, onConfirm,
}) => {
  if (!open) return null;

  const excludeLines = summary.lines.filter((line) => line.key === 'excludeUsers' || line.key === 'excludeTags');

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">準備正式發送</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-1">發送人數</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p className="text-gray-400 text-xs">符合條件</p>
                <p className="text-white font-bold text-xl">{matchedCount}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p className="text-gray-400 text-xs">已排除</p>
                <p className="text-amber-300 font-bold text-xl">{excludedCount}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-primary/30">
                <p className="text-gray-400 text-xs">實際發送</p>
                <p className="text-primary font-bold text-2xl">{finalCount}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">發送條件</p>
            <AudienceSummaryLines summary={summary} />
          </div>
          {excludeLines.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">排除條件</p>
              <ul className="space-y-1 text-sm text-amber-200/90">
                {excludeLines.map((line) => (
                  <li key={line.key}>• {line.label}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-1">訊息：{messageBlocks.length} 則</p>
            <ul className="space-y-2 text-sm">
              {messageBlocks.map((block, idx) => (
                <li key={block.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-gray-400 text-xs mb-1">{idx + 1}. {messageBlockTypeLabel(block.type)}</p>
                  {block.type === 'text' && (
                    <p className="text-white whitespace-pre-wrap line-clamp-3">{block.text.trim() || '（空白）'}</p>
                  )}
                  {block.type === 'image' && block.imageUrl && (
                    <img src={block.previewImageUrl || block.imageUrl} alt="" className="w-full max-h-24 object-cover rounded" />
                  )}
                  {block.type === 'carousel' && (
                    <p className="text-white">{block.items.length} 張輪播圖片</p>
                  )}
                </li>
              ))}
            </ul>
            {trackingUrl.trim() && (
              <p className="text-xs text-gray-500 mt-2">點擊連結：{formatLinkDisplay(trackingUrl)}</p>
            )}
            {title.trim() && <p className="text-gray-500 text-xs mt-2">內部標題：{title.trim()}</p>}
          </div>
          {audienceChangedMessage && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200 text-sm">
              {audienceChangedMessage}
            </div>
          )}
          <p className="text-amber-200/90 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            此操作將實際發送 LINE 訊息給 {finalCount} 位會員。
          </p>
          {sending && (
            <p className="text-primary text-sm flex items-center gap-2">
              <Loader size={16} className="animate-spin" /> {sendPhase}
            </p>
          )}
        </div>
        <div className="p-5 border-t border-gray-800 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 hover:text-white disabled:opacity-50"
          >
            返回修改
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending || finalCount === 0}
            className="flex-1 py-3 rounded-xl bg-primary text-black font-bold hover:bg-yellow-500 disabled:opacity-50"
          >
            {sending ? '發送中…' : `正式發送給 ${finalCount} 人`}
          </button>
        </div>
      </div>
    </div>
  );
};

const BroadcastSuccessModal: React.FC<{
  open: boolean;
  result: LineBroadcastSendResult | null;
  title: string;
  onViewHistory: () => void;
  onNewBroadcast: () => void;
}> = ({ open, result, title, onViewHistory, onNewBroadcast }) => {
  if (!open || !result) return null;
  const partial = result.sendStatus === 'partial';

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle size={28} className={partial ? 'text-amber-400' : 'text-green-400'} />
          <h3 className="text-white font-bold text-lg">{partial ? '部分完成' : 'LINE 推播已完成'}</h3>
        </div>
        <dl className="space-y-2 text-sm mb-6">
          <div><dt className="text-gray-500 inline">推播標題：</dt><dd className="text-white inline">{title || '—'}</dd></div>
          <div><dt className="text-gray-500 inline">發送對象：</dt><dd className="text-white inline">{result.totalCount ?? 0} 人</dd></div>
          {(result.successCount != null || result.failureCount != null) && (
            <>
              <div><dt className="text-gray-500 inline">成功：</dt><dd className="text-green-400 inline">{result.successCount ?? 0}</dd></div>
              <div><dt className="text-gray-500 inline">失敗：</dt><dd className="text-red-300 inline">{result.failureCount ?? 0}</dd></div>
            </>
          )}
          <div><dt className="text-gray-500 inline">時間：</dt><dd className="text-white inline">{formatDateTime(result.sentAt)}</dd></div>
        </dl>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onViewHistory} className="w-full py-2.5 rounded-xl bg-primary text-black font-bold">查看發送紀錄</button>
          <button type="button" onClick={onNewBroadcast} className="w-full py-2.5 rounded-xl border border-gray-600 text-gray-300">建立新推播</button>
        </div>
      </div>
    </div>
  );
};

export const LineBroadcastCompose: React.FC<{
  tags: MemberTag[];
  onEligibleCountChange?: (count: number | null) => void;
  onViewHistory: () => void;
}> = ({ tags, onEligibleCountChange, onViewHistory }) => {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [audienceMode, setAudienceMode] = useState<'all' | 'filtered'>('all');
  const [requireFavorites, setRequireFavorites] = useState(false);
  const [minFavorites, setMinFavorites] = useState<0 | 1 | 3 | 5>(0);
  const [lastLoginMode, setLastLoginMode] = useState<LineAudienceLastLoginMode>('any');
  const [subjectTagIds, setSubjectTagIds] = useState<number[]>([]);
  const [styleTagIds, setStyleTagIds] = useState<number[]>([]);
  const [manualTagIds, setManualTagIds] = useState<number[]>([]);
  const [showAudienceEditor, setShowAudienceEditor] = useState(false);
  const [showExclusionSection, setShowExclusionSection] = useState(false);
  const [excludeUserIds, setExcludeUserIds] = useState<string[]>([]);
  const [excludeTagIds, setExcludeTagIds] = useState<number[]>([]);
  const [excludedUsers, setExcludedUsers] = useState<LineTestRecipient[]>([]);
  const [showExcludeUserPicker, setShowExcludeUserPicker] = useState(false);

  const [subjectTags, setSubjectTags] = useState<ArtworkTaxonomyTag[]>([]);
  const [styleTags, setStyleTags] = useState<ArtworkTaxonomyTag[]>([]);
  const [taxonomyLoad, setTaxonomyLoad] = useState<AsyncLoadState<null>>(createAsyncLoadState(null));

  const [previewState, setPreviewState] = useState<AsyncLoadState<LineAudiencePreviewResponse | null>>(createAsyncLoadState(null));
  const previewRequestIdRef = useRef(0);

  const [title, setTitle] = useState('');
  const [messageBlocks, setMessageBlocks] = useState<MessageBlockState[]>(() => [createTextBlock()]);
  const [trackingUrl, setTrackingUrl] = useState('');
  const [showClickLink, setShowClickLink] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [artworkPickerTarget, setArtworkPickerTarget] = useState<{ blockId: string; itemId: string } | null>(null);

  const [testRecipient, setTestRecipient] = useState<LineTestRecipient | null>(() => loadTestRecipient());
  const [showTestPicker, setShowTestPicker] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<LineBroadcastTestSendResult | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmPreview, setConfirmPreview] = useState<LineAudiencePreviewResponse | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [formalSending, setFormalSending] = useState(false);
  const [sendPhase, setSendPhase] = useState('');
  const [audienceChangedMessage, setAudienceChangedMessage] = useState<string | null>(null);
  const sendRequestIdRef = useRef<string | null>(null);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [formalResult, setFormalResult] = useState<LineBroadcastSendResult | null>(null);

  const audienceFilter = buildAudienceFilter({
    mode: audienceMode,
    requireFavorites,
    minFavorites,
    lastLoginMode,
    subjectTagIds,
    styleTagIds,
    manualTagIds,
    excludeUserIds,
    excludeTagIds,
  });

  const audienceSummary = useMemo(
    () => buildLineAudienceSummary(audienceFilter, subjectTags, styleTags, tags),
    [audienceFilter, subjectTags, styleTags, tags],
  );

  const validateMessage = (): string | null => {
    const err = validateMessageBlocks(messageBlocks, trackingUrl);
    setMessageError(err);
    return err;
  };

  const firstTextPreview = messageBlocks.find((b) => b.type === 'text')?.text.trim() ?? '';

  const buildMessagePayload = () => ({
    title: title.trim() || firstTextPreview.slice(0, 30),
    messages: blocksToApiPayload(messageBlocks),
    trackingUrl: trackingUrl.trim() || undefined,
  });

  const handleUploadImage = async (file: File) => {
    setImageUploading(true);
    try {
      return await db.uploadLineBroadcastImage(file);
    } finally {
      setImageUploading(false);
    }
  };

  const applyArtworkLink = (artwork: Artwork) => {
    if (!artworkPickerTarget) return;
    const url = buildAppOriginUrl(`/artwork/${artwork.id}`);
    setMessageBlocks((prev) => prev.map((block) => {
      if (block.id !== artworkPickerTarget.blockId || block.type !== 'carousel') return block;
      return {
        ...block,
        items: block.items.map((item) => (
          item.id === artworkPickerTarget.itemId
            ? { ...item, targetUrl: url, label: artwork.title }
            : item
        )),
      };
    }));
    setArtworkPickerTarget(null);
  };

  useEffect(() => {
    let cancelled = false;
    setTaxonomyLoad((prev) => startLoading(prev));
    db.getArtworkTags()
      .then((catalog) => {
        if (cancelled) return;
        setSubjectTags(catalog.tagsByGroup.subject ?? []);
        setStyleTags(catalog.tagsByGroup.style ?? []);
        setTaxonomyLoad((prev) => loadSuccess(prev, null));
      })
      .catch((e) => {
        if (cancelled) return;
        setTaxonomyLoad((prev) => loadError(prev, '作品標籤載入失敗'));
        logAdminFetchError('getArtworkTags', e);
      });
    return () => { cancelled = true; };
  }, []);

  const fetchAudiencePreview = () => {
    const requestId = ++previewRequestIdRef.current;
    setPreviewState((prev) => startLoading(prev));
    return db.previewLineBroadcastAudience(audienceFilter)
      .then((result) => {
        if (requestId !== previewRequestIdRef.current) return result;
        setPreviewState((prev) => loadSuccess(prev, result));
        onEligibleCountChange?.(result.finalCount);
        return result;
      })
      .catch((e) => {
        if (requestId !== previewRequestIdRef.current) throw e;
        setPreviewState((prev) => loadError(prev, '受眾資料載入失敗'));
        logAdminFetchError('previewLineBroadcastAudience', e);
        throw e;
      });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchAudiencePreview(); }, AUDIENCE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceMode, requireFavorites, minFavorites, lastLoginMode, subjectTagIds, styleTagIds, manualTagIds, excludeUserIds, excludeTagIds]);

  const preview = previewState.data;
  const matchedCount = preview?.matchedCount ?? 0;
  const excludedCount = preview?.excludedCount ?? 0;
  const finalCount = preview?.finalCount ?? matchedCount;

  const handleTestSend = async () => {
    const err = validateMessage();
    if (err) return;
    if (!testRecipient) {
      setShowTestPicker(true);
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const result = await db.sendLineBroadcastTest({
        ...buildMessagePayload(),
        testUserId: testRecipient.userId,
      });
      setTestResult(result);
      if (!result.success) {
        setMessageError(formatLineSendError(result));
      }
    } catch (e: any) {
      setTestResult({ success: false, errors: [e.message] });
      setMessageError(e.message);
    } finally {
      setTestSending(false);
    }
  };

  const openFinalConfirm = async () => {
    const err = validateMessage();
    if (err) return;
    if (finalCount === 0) {
      setMessageError('目前沒有符合條件的可推播會員');
      return;
    }
    setAudienceChangedMessage(null);
    setConfirmLoading(true);
    setShowConfirmModal(true);
    try {
      const fresh = await db.previewLineBroadcastAudience(audienceFilter);
      setConfirmPreview(fresh);
    } catch {
      setConfirmPreview(preview);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleFormalSend = async () => {
    const confirmed = confirmPreview?.finalCount ?? finalCount;
    if (confirmed === 0) return;

    const requestId = crypto.randomUUID();
    sendRequestIdRef.current = requestId;
    setFormalSending(true);
    setSendPhase('正在準備受眾…');
    setAudienceChangedMessage(null);

    try {
      setSendPhase('正在發送 LINE 訊息…');
      const result = await db.sendLineBroadcast({
        ...buildMessagePayload(),
        audienceFilter,
        confirmedCount: confirmed,
        requestId,
      });

      if (result.code === 'AUDIENCE_CHANGED') {
        setAudienceChangedMessage(
          `發送對象已變更，由 ${result.previousCount} 人變成 ${result.currentCount} 人，請重新確認。`,
        );
        if (result.currentCount != null) {
          setConfirmPreview((prev) => prev ? {
            ...prev,
            finalCount: result.currentCount!,
            matchedCount: prev.matchedCount,
            excludedCount: Math.max(0, prev.matchedCount - result.currentCount!),
          } : prev);
        }
        return;
      }

      if (!result.success && !result.partial && !result.duplicate) {
        setAudienceChangedMessage(formatLineSendError(result));
        return;
      }

      setFormalResult(result);
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (e: any) {
      setAudienceChangedMessage(e.message || '發送失敗');
    } finally {
      setFormalSending(false);
      setSendPhase('');
    }
  };

  const resetForNewBroadcast = () => {
    setTitle('');
    setMessageBlocks([createTextBlock()]);
    setTrackingUrl('');
    setShowClickLink(false);
    setTestResult(null);
    setFormalResult(null);
    setShowSuccessModal(false);
    setMessageError(null);
  };

  const confirmFinalCount = confirmLoading
    ? finalCount
    : (confirmPreview?.finalCount ?? finalCount);
  const confirmMatchedCount = confirmLoading
    ? matchedCount
    : (confirmPreview?.matchedCount ?? matchedCount);
  const confirmExcludedCount = confirmLoading
    ? excludedCount
    : (confirmPreview?.excludedCount ?? excludedCount);

  const addExcludedUser = (recipient: LineTestRecipient) => {
    if (excludeUserIds.includes(recipient.userId)) return;
    setExcludeUserIds((prev) => [...prev, recipient.userId]);
    setExcludedUsers((prev) => [...prev, recipient]);
  };

  const removeExcludedUser = (userId: string) => {
    setExcludeUserIds((prev) => prev.filter((id) => id !== userId));
    setExcludedUsers((prev) => prev.filter((u) => u.userId !== userId));
  };

  return (
    <>
      <AudiencePreviewModal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        previewState={previewState}
        onRetry={() => void fetchAudiencePreview()}
      />
      <TestRecipientPickerModal
        open={showTestPicker}
        onClose={() => setShowTestPicker(false)}
        onSelect={(r) => { setTestRecipient(r); saveTestRecipient(r); }}
      />
      <ArtworkPickerModal
        open={artworkPickerTarget !== null}
        onClose={() => setArtworkPickerTarget(null)}
        onSelect={applyArtworkLink}
      />
      <ExcludeUserPickerModal
        open={showExcludeUserPicker}
        onClose={() => setShowExcludeUserPicker(false)}
        excludedUserIds={excludeUserIds}
        onSelect={addExcludedUser}
      />
      <FinalConfirmModal
        open={showConfirmModal}
        onClose={() => { if (!formalSending) setShowConfirmModal(false); }}
        summary={audienceSummary}
        matchedCount={confirmMatchedCount}
        excludedCount={confirmExcludedCount}
        finalCount={confirmFinalCount}
        title={title}
        messageBlocks={messageBlocks}
        trackingUrl={trackingUrl}
        sending={formalSending}
        sendPhase={sendPhase}
        audienceChangedMessage={audienceChangedMessage}
        onConfirm={handleFormalSend}
      />
      <BroadcastSuccessModal
        open={showSuccessModal}
        result={formalResult}
        title={title.trim()}
        onViewHistory={() => { setShowSuccessModal(false); onViewHistory(); }}
        onNewBroadcast={resetForNewBroadcast}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ① 發送對象 */}
        <div className="space-y-5">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Users size={18} className="text-primary" />
              發送對象
            </h3>

            {!showAudienceEditor ? (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">
                    {audienceMode === 'all' ? '全部可推播會員' : '條件篩選'}
                  </p>
                  <p className="text-primary font-bold text-xl">符合：{matchedCount} 位可推播會員</p>
                  {(excludedCount > 0 || finalCount !== matchedCount) && (
                    <div className="text-sm text-gray-400 space-y-1 mt-2">
                      <p>已排除：<span className="text-amber-300 font-semibold">{excludedCount}</span> 人</p>
                      <p>實際發送：<span className="text-primary font-semibold">{finalCount}</span> 人</p>
                    </div>
                  )}
                </div>
                {audienceMode === 'filtered' && (
                  <div className="rounded-lg bg-gray-900/60 border border-gray-700/60 p-4">
                    <p className="text-xs text-gray-400 mb-2">目前條件</p>
                    <AudienceSummaryLines summary={audienceSummary} />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setShowAudienceEditor(true)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white">
                    <Pencil size={14} /> 修改條件
                  </button>
                  {finalCount > 0 && previewState.status === 'success' && (
                    <button type="button" onClick={() => setShowPreviewModal(true)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10">
                      <Eye size={14} /> 查看符合名單
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {previewState.status === 'success' && preview && (
                  <p className="text-gray-400 text-xs">可推播 LINE 會員：{preview.totalEligible} 人</p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAudienceMode('all')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${audienceMode === 'all' ? 'bg-primary text-black' : 'bg-gray-700 text-gray-300'}`}>全部可推播會員</button>
                  <button type="button" onClick={() => setAudienceMode('filtered')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${audienceMode === 'filtered' ? 'bg-primary text-black' : 'bg-gray-700 text-gray-300'}`}>條件篩選</button>
                </div>
                {audienceMode === 'filtered' && (
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                    <div>
                      <p className="text-white text-sm font-medium mb-2">會員行為</p>
                      <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                        <input type="checkbox" checked={requireFavorites} onChange={(e) => setRequireFavorites(e.target.checked)} className="rounded" />
                        有收藏作品
                      </label>
                      {requireFavorites && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {([[0, '不限'], [1, '至少 1 件'], [3, '至少 3 件'], [5, '至少 5 件']] as const).map(([v, l]) => (
                            <SelectableChip key={v} label={l} selected={minFavorites === v} onClick={() => setMinFavorites(v)} />
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mb-2">最後活動</p>
                      <div className="flex flex-wrap gap-2">
                        {([['any', '不限'], ['within_30_days', '30 天內'], ['within_90_days', '90 天內'], ['inactive_90_days', '90 天以上未登入']] as const).map(([v, l]) => (
                          <SelectableChip key={v} label={l} selected={lastLoginMode === v} onClick={() => setLastLoginMode(v)} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium mb-2">收藏興趣</p>
                      {taxonomyLoad.status === 'loading' ? <p className="text-gray-500 text-sm">載入中…</p> : (
                        <>
                          <p className="text-xs text-gray-400 mb-1">題材</p>
                          <div className="flex flex-wrap gap-2 mb-3">{subjectTags.map((t) => (
                            <SelectableChip key={t.id} label={t.displayName} selected={subjectTagIds.includes(t.id)} onClick={() => setSubjectTagIds((p) => toggleChipId(p, t.id))} />
                          ))}</div>
                          <p className="text-xs text-gray-400 mb-1">風格</p>
                          <div className="flex flex-wrap gap-2">{styleTags.map((t) => (
                            <SelectableChip key={t.id} label={t.displayName} selected={styleTagIds.includes(t.id)} onClick={() => setStyleTagIds((p) => toggleChipId(p, t.id))} />
                          ))}</div>
                        </>
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium mb-2">手動標籤</p>
                      <div className="flex flex-wrap gap-2">{tags.map((t) => (
                        <SelectableChip key={t.id} label={t.name} selected={manualTagIds.includes(t.id)} onClick={() => setManualTagIds((p) => toggleChipId(p, t.id))} />
                      ))}</div>
                    </div>
                  </div>
                )}
                <div className="pt-3 border-t border-gray-700 flex items-center justify-between">
                  <div>
                    <p className="text-primary font-semibold">符合 {matchedCount} 人</p>
                    {(excludedCount > 0 || finalCount !== matchedCount) && (
                      <p className="text-xs text-gray-400 mt-1">
                        排除 {excludedCount} 人 · 實際發送 {finalCount} 人
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowAudienceEditor(false)} className="text-sm text-primary hover:underline">完成</button>
                </div>
              </div>
            )}

            <div className="mt-4 border border-gray-700 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowExclusionSection((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 text-left"
              >
                <span className="text-white text-sm font-medium">排除條件</span>
                {showExclusionSection ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {showExclusionSection && (
                <div className="p-4 space-y-4 border-t border-gray-700">
                  <div>
                    <p className="text-sm text-gray-300 mb-2">排除指定會員</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {excludedUsers.map((u) => (
                        <span key={u.userId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800 border border-gray-600 text-sm text-gray-200">
                          {u.displayName}
                          <button type="button" onClick={() => removeExcludedUser(u.userId)} className="text-gray-400 hover:text-white"><X size={14} /></button>
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowExcludeUserPicker(true)}
                      className="text-sm px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white"
                    >
                      + 選擇會員
                    </button>
                  </div>
                  <div>
                    <p className="text-sm text-gray-300 mb-2">排除標籤</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((t) => (
                        <SelectableChip
                          key={`ex-${t.id}`}
                          label={t.name}
                          selected={excludeTagIds.includes(t.id)}
                          onClick={() => setExcludeTagIds((p) => toggleChipId(p, t.id))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右欄：② 訊息 + ③ 發送 */}
        <div className="space-y-5">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              訊息內容
            </h3>
            <p className="text-xs text-gray-500 mb-4">最多 3 則</p>
            {messageError && <p className="text-amber-300 text-sm mb-3">{messageError}</p>}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">內部標題</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：8月新作品通知" className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" maxLength={50} />
            </div>
            <LineBroadcastMessageBlocks
              blocks={messageBlocks}
              onChange={setMessageBlocks}
              trackingUrl={trackingUrl}
              onTrackingUrlChange={setTrackingUrl}
              showClickLink={showClickLink}
              onShowClickLinkChange={setShowClickLink}
              imageUploading={imageUploading}
              onUploadImage={handleUploadImage}
              onPickArtwork={(blockId, itemId) => setArtworkPickerTarget({ blockId, itemId })}
            />
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-4">發送</h3>
            <div className="mb-4 rounded-lg bg-gray-900/60 border border-gray-700/60 p-3">
              <p className="text-xs text-gray-400 mb-1">測試收件人</p>
              {testRecipient ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-white text-sm">{testRecipient.displayName}</p>
                    <p className="text-gray-500 text-xs font-mono">LINE ID：{testRecipient.lineIdMasked}</p>
                  </div>
                  <button type="button" onClick={() => setShowTestPicker(true)} className="text-xs text-primary">變更</button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowTestPicker(true)} className="text-sm text-primary">選擇測試收件人</button>
              )}
            </div>
            {testResult && (
              <div className={`mb-4 rounded-lg p-3 border text-sm ${testResult.success ? 'border-green-800 bg-green-900/20 text-green-300' : 'border-red-800 bg-red-900/20 text-red-300'}`}>
                {testResult.success ? (
                  <>
                    <p className="font-medium flex items-center gap-1"><CheckCircle size={16} /> 測試訊息已傳送</p>
                    <p className="mt-1 text-xs opacity-90">收件人：{testResult.recipientName}</p>
                    <p className="text-xs opacity-90">時間：{formatDateTime(testResult.sentAt)}</p>
                    <p className="text-xs mt-2 opacity-80">請先至 LINE 確認內容是否正常。</p>
                  </>
                ) : (
                  <p>{formatLineSendError(testResult)}</p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleTestSend} disabled={testSending} className="w-full py-3 rounded-xl border border-gray-600 text-white font-medium hover:bg-gray-700/50 disabled:opacity-50 flex items-center justify-center gap-2">
                {testSending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                傳送測試
              </button>
              <button
                type="button"
                onClick={openFinalConfirm}
                disabled={previewState.status !== 'success' || finalCount === 0 || confirmLoading}
                className="w-full py-3 rounded-xl bg-primary text-black font-bold hover:bg-yellow-500 disabled:opacity-50"
              >
                {confirmLoading ? '驗證受眾中…' : '檢查並準備正式發送'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
