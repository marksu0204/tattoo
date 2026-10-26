import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { logAdminFetchError } from '../utils/adminFetch';
import {
  createAsyncLoadState,
  loadError,
  loadSuccess,
  startLoading,
  type AsyncLoadState,
} from '../utils/asyncLoadState';
import { LineBroadcastCompose } from './LineBroadcastCompose';
import SafeAvatar from './SafeAvatar';
import { resolveBroadcastAudienceDisplay } from '../utils/lineAudienceSummary';
import { broadcastMessageDisplaySummary } from '../utils/lineBroadcastMessages';
import { formatLinkDisplay } from '../utils/lineCarousel';
import { MemberTag, LineBroadcast, LineBroadcastDetail } from '../types';
import {
  Tag, Plus, Trash2, Send, Users, MessageSquare, Clock,
  ChevronDown, ChevronUp, X, Image, CheckCircle,
  BarChart2, AlertCircle, Eye, Loader, RefreshCw,
} from 'lucide-react';

const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6',
];

const TagBadge: React.FC<{ tag: MemberTag; onRemove?: () => void }> = ({ tag, onRemove }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
    style={{ backgroundColor: tag.color }}
  >
    {tag.name}
    {onRemove && (
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
        <X size={10} />
      </button>
    )}
  </span>
);

const TagsPanel: React.FC<{
  tags: MemberTag[];
  onRefresh: () => void;
  tagsLoad: AsyncLoadState<null>;
}> = ({ tags, onRefresh, tagsLoad }) => {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) { alert('請輸入標籤名稱'); return; }
    setCreating(true);
    try {
      await db.createTag(newName.trim(), newColor);
      setNewName('');
      onRefresh();
    } catch (e: any) {
      alert(`建立失敗：${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`確定要刪除標籤「${name}」嗎？此操作不會移除會員身上的該標籤。`)) return;
    setDeleting(id);
    try {
      await db.deleteTag(id);
      onRefresh();
    } catch (e: any) {
      alert(`刪除失敗：${e.message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Plus size={18} className="text-primary" />
          新增標籤
        </h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-gray-400 mb-1">標籤名稱</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="例：老客、VIP"
              className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">顏色</label>
            <div className="flex gap-1.5 flex-wrap max-w-[220px]">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex items-center gap-2 bg-primary text-black font-bold px-4 py-2 rounded-lg hover:bg-yellow-500 disabled:opacity-50 text-sm"
          >
            {creating ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
            新增
          </button>
        </div>
        {newName.trim() && (
          <div className="mt-3">
            <span className="text-xs text-gray-400 mr-2">預覽：</span>
            <TagBadge tag={{ id: 0, name: newName.trim(), color: newColor, userCount: 0 }} />
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Tag size={18} className="text-primary" />
            所有標籤 <span className="text-gray-400 font-normal text-sm">({tagsLoad.status === 'loading' && !tagsLoad.hasLoadedOnce ? '…' : tags.length})</span>
          </h3>
          <button type="button" onClick={onRefresh} className="text-gray-400 hover:text-white"><RefreshCw size={16} /></button>
        </div>
        {tagsLoad.status === 'loading' && !tagsLoad.hasLoadedOnce ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">標籤載入中…</div>
        ) : tags.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-500 text-sm">尚無標籤</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {tags.map((tag) => (
              <div key={tag.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-white text-sm font-medium">{tag.name}</span>
                  <span className="text-gray-500 text-xs">{tag.userCount} 位會員</span>
                </div>
                <button type="button" onClick={() => handleDelete(tag.id, tag.name)} disabled={deleting === tag.id} className="text-gray-500 hover:text-red-400 disabled:opacity-50">
                  {deleting === tag.id ? <Loader size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const RECIPIENT_PAGE_SIZE = 50;

const HistoryPanel: React.FC<{ tags: MemberTag[] }> = ({ tags }) => {
  const [broadcasts, setBroadcasts] = useState<LineBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LineBroadcastDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recipientOffset, setRecipientOffset] = useState(0);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setLoadErrorMessage(null);
    try {
      setBroadcasts(await db.getLineBroadcasts());
      setHasLoadedOnce(true);
    } catch (e) {
      setLoadErrorMessage('發送紀錄載入失敗');
      logAdminFetchError('getLineBroadcasts', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number, offset = 0) => {
    setLoadingDetail(true);
    try {
      const d = await db.getLineBroadcastDetail(id, offset, RECIPIENT_PAGE_SIZE);
      setDetail(d);
      setRecipientOffset(offset);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleDetail = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    setDetail(null);
    await loadDetail(id, 0);
  };

  if (loading && !hasLoadedOnce) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={28} className="animate-spin text-primary" />
        <span className="ml-3 text-gray-400">發送紀錄載入中…</span>
      </div>
    );
  }

  if (loadErrorMessage && !hasLoadedOnce && broadcasts.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-amber-300 mb-4">{loadErrorMessage}</p>
        <button type="button" onClick={load} className="px-4 py-2 rounded-lg bg-primary text-black font-bold">重新載入</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          發送紀錄 <span className="text-gray-400 font-normal text-sm">({broadcasts.length})</span>
        </h3>
        <button type="button" onClick={load} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
          <RefreshCw size={14} /> 重新整理
        </button>
      </div>

      {broadcasts.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 px-5 py-16 text-center text-gray-500">尚未發送過任何推播訊息</div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((bc) => {
            const audienceLines = resolveBroadcastAudienceDisplay(bc, tags);
            const messageSummary = broadcastMessageDisplaySummary(bc);
            return (
              <div key={bc.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="px-5 py-4 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => toggleDetail(bc.id)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white font-medium truncate">{bc.title}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(bc.sentAt).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {bc.sendStatus === 'partial' && <span className="text-xs text-amber-400">部分完成</span>}
                      </div>
                      <p className="text-gray-400 text-sm truncate">{bc.content}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Users size={11} /> {bc.totalCount} 人</span>
                        <span className="text-xs text-gray-500">{messageSummary.count} 則訊息</span>
                        <span className="text-xs text-gray-500 truncate max-w-full">{audienceLines.join(' · ')}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-bold text-primary">{bc.openRate}%</div>
                      <div className="text-xs text-gray-400">點擊率</div>
                      <div className="text-xs text-gray-500">{bc.uniqueClickers ?? bc.clickCount}/{bc.successCount && bc.successCount > 0 ? bc.successCount : bc.totalCount}</div>
                    </div>
                    <div className="flex-shrink-0 text-gray-400 self-center">
                      {expandedId === bc.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(bc.openRate, 100)}%` }} />
                  </div>
                </div>

                {expandedId === bc.id && (
                  <div className="border-t border-gray-700 px-5 py-4">
                    {loadingDetail ? (
                      <div className="flex justify-center py-6"><Loader size={20} className="animate-spin text-gray-400" /></div>
                    ) : detail && detail.id === bc.id ? (
                      <div>
                        {(() => {
                          const detailMessageSummary = broadcastMessageDisplaySummary(detail);
                          return (
                            <>
                        <div className="mb-4 p-3 bg-gray-900 rounded-lg">
                          <p className="text-xs text-gray-400 mb-2">受眾條件</p>
                          <ul className="text-sm text-gray-300 space-y-1 mb-3">
                            {audienceLines.map((line) => <li key={line}>✓ {line}</li>)}
                          </ul>
                          <p className="text-xs text-gray-400 mb-2">訊息內容：{detailMessageSummary.count} 則</p>
                          <ul className="text-sm text-gray-300 space-y-2 mb-3">
                            {detailMessageSummary.lines.map((line) => <li key={line}>{line}</li>)}
                          </ul>
                          {(detail.imageUrls && detail.imageUrls.length > 0) && (
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {detail.imageUrls.slice(0, 10).map((u, idx) => (
                                <img key={idx} src={u} alt="" className="w-20 h-14 object-cover rounded border border-gray-700" />
                              ))}
                            </div>
                          )}
                          <p className="text-gray-300 text-sm whitespace-pre-wrap">{detail.content}</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                          {[
                            { label: '發送人數', value: detail.successCount && detail.successCount > 0 ? detail.successCount : detail.totalCount, icon: Send, color: 'text-blue-400' },
                            { label: '點擊次數', value: detail.totalClicks ?? 0, icon: Eye, color: 'text-green-400' },
                            { label: '點擊人數', value: detail.uniqueClickers ?? detail.clickCount, icon: Users, color: 'text-emerald-400' },
                            { label: '點擊率', value: `${detail.openRate}%`, icon: BarChart2, color: 'text-primary' },
                          ].map((s) => (
                            <div key={s.label} className="bg-gray-900 rounded-lg p-3 text-center">
                              <s.icon size={18} className={`${s.color} mx-auto mb-1`} />
                              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                              <div className="text-xs text-gray-500">{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {detail.carouselTrackingAvailable && detail.carouselAnalytics && detail.carouselAnalytics.length > 0 ? (
                          <div className="mb-4">
                            <p className="text-xs text-gray-400 mb-2">輪播圖片成效</p>
                            <div className="overflow-x-auto rounded-lg border border-gray-700">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-900 text-gray-400 text-xs">
                                    <th className="text-left p-2">輪播圖片</th>
                                    <th className="text-right p-2">點擊</th>
                                    <th className="text-right p-2">獨立點擊者</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.carouselAnalytics.map((row, idx) => (
                                    <tr key={row.id} className="border-t border-gray-800">
                                      <td className="p-2">
                                        <div className="flex items-center gap-2">
                                          <img src={row.previewUrl} alt="" className="w-10 h-10 rounded object-cover border border-gray-700" />
                                          <div className="min-w-0">
                                            <p className="text-gray-200 truncate">
                                              {row.label?.trim() || `圖片 ${idx + 1}`}
                                              {idx === 0 && row.totalClicks > 0 && (
                                                <span className="ml-1 text-primary text-xs">點擊最多</span>
                                              )}
                                            </p>
                                            {row.targetUrl?.trim() && (
                                              <p className="text-gray-500 text-xs truncate">{formatLinkDisplay(row.targetUrl)}</p>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-2 text-right text-green-400">{row.totalClicks}</td>
                                      <td className="p-2 text-right text-gray-300">{row.uniqueClickers}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-t border-gray-700 bg-gray-900/80 font-medium">
                                    <td className="p-2 text-gray-300">總計</td>
                                    <td className="p-2 text-right text-primary">
                                      {detail.carouselAnalytics.reduce((s, r) => s + r.totalClicks, 0)}
                                    </td>
                                    <td className="p-2 text-right text-gray-500">—</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : !detail.carouselTrackingAvailable && (detail.imageUrls?.length ?? 0) > 1 ? (
                          <p className="text-xs text-gray-500 mb-4">此推播建立於輪播獨立追蹤功能上線前。</p>
                        ) : null}

                        <div>
                          <p className="text-xs text-gray-400 mb-2">
                            實際收件人（{detail.recipientTotal ?? detail.recipients.length} 人，顯示 {recipientOffset + 1}–{recipientOffset + detail.recipients.length}）
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {detail.recipients.map((r) => (
                              <div key={r.userId} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${r.clicked ? 'border-green-800 bg-green-900/10' : 'border-gray-700 bg-gray-900'}`}>
                                <SafeAvatar src={r.avatarUrl} alt={r.userName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" iconSize={13} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-gray-300 text-xs truncate">{r.userName}</p>
                                  {r.lineIdMasked && <p className="text-gray-600 text-[10px] font-mono">{r.lineIdMasked}</p>}
                                  {r.sendStatus === 'failed' && <p className="text-red-400 text-[10px]">發送失敗</p>}
                                </div>
                                {r.clicked ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" /> : <span className="text-gray-600 text-xs">未點</span>}
                              </div>
                            ))}
                          </div>
                          {(detail.recipientTotal ?? 0) > RECIPIENT_PAGE_SIZE && (
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                disabled={recipientOffset === 0 || loadingDetail}
                                onClick={() => loadDetail(detail.id, Math.max(0, recipientOffset - RECIPIENT_PAGE_SIZE))}
                                className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-300 disabled:opacity-40"
                              >
                                上一頁
                              </button>
                              <button
                                type="button"
                                disabled={recipientOffset + RECIPIENT_PAGE_SIZE >= (detail.recipientTotal ?? 0) || loadingDetail}
                                onClick={() => loadDetail(detail.id, recipientOffset + RECIPIENT_PAGE_SIZE)}
                                className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-300 disabled:opacity-40"
                              >
                                下一頁
                              </button>
                            </div>
                          )}
                        </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const CustomerTagModal: React.FC<{
  customer: any;
  tags: MemberTag[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ customer, tags, onClose, onSaved }) => {
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.getUserTags(customer.id).then((ids) => { setSelectedTags(ids); setLoading(false); });
  }, [customer.id]);

  const toggle = (id: number) =>
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.setUserTags(customer.id, selectedTags);
      onSaved();
      onClose();
    } catch (e: any) {
      alert(`儲存失敗：${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {customer.avatarUrl
              ? <img src={customer.avatarUrl} alt={customer.name} className="w-10 h-10 rounded-full object-cover border border-gray-600" />
              : <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center"><Users size={18} className="text-gray-400" /></div>
            }
            <div>
              <p className="text-white font-semibold">{customer.name}</p>
              <p className="text-gray-500 text-xs">設定會員標籤</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader size={22} className="animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 ${selectedTags.includes(tag.id) ? 'text-white border-transparent' : 'text-gray-300 border-gray-600'}`}
                  style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                >
                  {selectedTags.includes(tag.id) ? '✓ ' : ''}{tag.name}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-primary text-black font-bold py-2.5 rounded-xl disabled:opacity-50">
                {saving ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                儲存
              </button>
              <button type="button" onClick={onClose} className="flex-1 bg-gray-700 text-white py-2.5 rounded-xl">取消</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

type SubView = 'compose' | 'tags' | 'history';

const LineMessagingTab: React.FC<{
  customers: any[];
  customersLoad: AsyncLoadState<null>;
  memberTags: MemberTag[];
  memberTagsLoad: AsyncLoadState<null>;
  onReloadCustomers: () => void;
  onReloadTags: () => void;
}> = ({ customers, customersLoad, memberTags, memberTagsLoad, onReloadCustomers, onReloadTags }) => {
  const [subView, setSubView] = useState<SubView>('compose');
  const [eligibleLineCount, setEligibleLineCount] = useState<number | null>(null);

  const navItems: Array<{ id: SubView; label: string; icon: React.ReactNode }> = [
    { id: 'compose', label: '發送訊息', icon: <Send size={16} /> },
    { id: 'tags', label: '標籤管理', icon: <Tag size={16} /> },
    { id: 'history', label: '發送紀錄', icon: <BarChart2 size={16} /> },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#00B900]/20 flex items-center justify-center border border-[#00B900]/30">
          <MessageSquare size={20} className="text-[#00B900]" />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg">LINE 推播管理</h2>
          <p className="text-gray-400 text-xs">
            動態受眾 · 安全發送流程
            {customersLoad.status === 'loading' && !customersLoad.hasLoadedOnce
              ? ' · 會員資料載入中…'
              : eligibleLineCount != null
                ? ` · 可推播 LINE 會員 ${eligibleLineCount} 人`
                : ` · 共 ${customers.length} 位會員`}
          </p>
        </div>
      </div>

      {(customersLoad.error || memberTagsLoad.error) && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-amber-200">{[customersLoad.error, memberTagsLoad.error].filter(Boolean).join(' · ')}</p>
          <div className="flex gap-2">
            {customersLoad.error && <button type="button" onClick={onReloadCustomers} className="text-sm px-3 py-1.5 rounded-lg border border-amber-400/40 text-amber-100">重新載入會員</button>}
            {memberTagsLoad.error && <button type="button" onClick={onReloadTags} className="text-sm px-3 py-1.5 rounded-lg border border-amber-400/40 text-amber-100">重新載入標籤</button>}
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-gray-800 rounded-xl p-1 mb-6 w-fit flex-wrap">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSubView(item.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${subView === item.id ? 'bg-gray-900 text-primary shadow' : 'text-gray-400 hover:text-white'}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {subView === 'compose' && (
        <LineBroadcastCompose
          tags={memberTags}
          onEligibleCountChange={setEligibleLineCount}
          onViewHistory={() => setSubView('history')}
        />
      )}
      {subView === 'tags' && <TagsPanel tags={memberTags} onRefresh={onReloadTags} tagsLoad={memberTagsLoad} />}
      {subView === 'history' && <HistoryPanel tags={memberTags} />}
    </div>
  );
};

export default LineMessagingTab;
