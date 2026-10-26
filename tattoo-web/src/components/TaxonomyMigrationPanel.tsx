import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Play, RotateCcw, Tags, X } from 'lucide-react';
import { db } from '../services/mockBackend';
import type { AdminContextBrand, Artwork, ArtworkTaxonomyTag } from '../types';
import { resolvePublicAssetUrl } from '../utils/publicAssetUrl';
import { buildArtworkTaxonomyUpdatePayload } from '../utils/artworkPngBatch';
import {
  NEW_TAGS,
  NEW_TAG_NAME,
  RETIRED_TAG_KEYS,
  KEEP_TAG_KEYS,
  buildNewTagIds,
  proposeForArtwork,
} from '../utils/taxonomyMigration';

const DELAY_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SUBJECT_OPTIONS = NEW_TAGS.filter((t) => t.group === 'subject');
const STYLE_OPTIONS = NEW_TAGS.filter((t) => t.group === 'style');

interface Choice {
  subject: string | null;
  style: string | null;
  needsReview: boolean;
}

interface Backup {
  createdAt: string;
  tags: Array<Pick<ArtworkTaxonomyTag, 'id' | 'tagKey' | 'displayName' | 'isActive'>>;
  artworks: Array<{ id: string; title: string; tagIds: number[]; category: string }>;
}

type Phase = 'loading' | 'review' | 'applying' | 'done' | 'reverting' | 'error';

interface Props {
  open: boolean;
  onClose: () => void;
  currentAdminBrand: AdminContextBrand | null;
  onFinished: () => void;
}

const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

const TaxonomyMigrationPanel: React.FC<Props> = ({ open, onClose, currentAdminBrand, onFinished }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [catalog, setCatalog] = useState<ArtworkTaxonomyTag[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [view, setView] = useState<'all' | 'review'>('review');
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [backup, setBackup] = useState<Backup | null>(null);
  const loadedRef = useRef(false);

  const oldNamesOf = (a: Artwork) =>
    (a.tagIds ?? [])
      .map((id) => catalog.find((t) => t.id === Number(id)))
      .filter((t): t is ArtworkTaxonomyTag => Boolean(t) && (t!.groupKey === 'subject' || t!.groupKey === 'style'))
      .map((t) => t.displayName)
      .join('、');

  const pushLog = (line: string) => setLog((prev) => [...prev, line]);

  const load = async () => {
    setPhase('loading');
    setError('');
    try {
      const [arts, tags] = await Promise.all([db.getAdminArtworks(), db.getArtworkTags({ admin: true })]);
      const kById = Object.fromEntries(tags.tags.map((t) => [t.id, t.tagKey]));
      const next: Record<string, Choice> = {};
      for (const a of arts) {
        const oldKeys = (a.tagIds ?? []).map((id) => kById[Number(id)]).filter(Boolean) as string[];
        next[a.id] = proposeForArtwork(a.id, oldKeys);
      }
      setArtworks(arts);
      setCatalog(tags.tags);
      setChoices(next);
      setPhase('review');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '載入失敗');
      setPhase('error');
    }
  };

  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      void load();
    }
  }, [open]);

  const busy = phase === 'applying' || phase === 'reverting';
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    Object.values(choices).forEach((ch) => {
      if (ch.subject) c[ch.subject] = (c[ch.subject] ?? 0) + 1;
      if (ch.style) c[ch.style] = (c[ch.style] ?? 0) + 1;
    });
    return c;
  }, [choices]);
  const reviewCount = Object.values(choices).filter((c) => c.needsReview).length;
  const missingCount = Object.values(choices).filter((c) => !c.subject || !c.style).length;
  const visible = artworks.filter((a) => view === 'all' || choices[a.id]?.needsReview);

  const setChoice = (id: string, patch: Partial<Choice>) =>
    setChoices((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const apply = async () => {
    if (missingCount > 0) {
      alert(`還有 ${missingCount} 件作品沒有選題材或風格，請先補上。`);
      return;
    }
    if (!window.confirm(
      `即將套用新分類到 ${artworks.length} 件作品，並把舊標籤改名／停用。\n\n` +
      '開始前會自動下載一份備份檔，完成後也可以按「復原」換回原本的分類。確定開始？'
    )) return;

    setPhase('applying');
    setLog([]);
    try {
      // 0. 重新讀取最新資料並備份
      const [freshArts, freshTags] = await Promise.all([db.getAdminArtworks(), db.getArtworkTags({ admin: true })]);
      const tags = freshTags.tags;
      const snap: Backup = {
        createdAt: new Date().toISOString(),
        tags: tags.map((t) => ({ id: t.id, tagKey: t.tagKey, displayName: t.displayName, isActive: t.isActive })),
        artworks: freshArts.map((a) => ({ id: a.id, title: a.title, tagIds: (a.tagIds ?? []).map(Number), category: a.category })),
      };
      setBackup(snap);
      downloadJson(snap, `inkflow-taxonomy-backup-${Date.now()}.json`);
      pushLog('已下載備份檔');

      const byKey = Object.fromEntries(tags.map((t) => [t.tagKey, t]));
      const idByKey: Record<string, number> = Object.fromEntries(tags.map((t) => [t.tagKey, t.id]));
      const kById = Object.fromEntries(tags.map((t) => [t.id, t.tagKey]));

      // 1. 確保新標籤啟用並改成新名稱
      for (const def of NEW_TAGS) {
        const tag = byKey[def.tagKey];
        if (!tag) throw new Error(`找不到標籤 ${def.tagKey}`);
        if (!tag.isActive) await db.toggleArtworkTag(tag.id, true);
        if (tag.displayName !== def.name) {
          await db.updateArtworkTag(tag.id, def.name);
          pushLog(`改名：${tag.displayName} → ${def.name}`);
        }
      }
      for (const key of KEEP_TAG_KEYS) {
        const tag = byKey[key];
        if (tag && !tag.isActive) await db.toggleArtworkTag(tag.id, true);
      }

      // 2. 逐件套用
      setProgress({ done: 0, total: freshArts.length, failed: 0 });
      let failed = 0;
      for (let i = 0; i < freshArts.length; i += 1) {
        const art = freshArts[i];
        const choice = choices[art.id] ?? proposeForArtwork(art.id, []);
        const oldKeys = (art.tagIds ?? []).map((id) => kById[Number(id)]).filter(Boolean) as string[];
        const tagIds = buildNewTagIds(choice, oldKeys, idByKey);
        const category = (choice.subject && NEW_TAG_NAME[choice.subject]) || art.category;
        const unchanged = sameIds(tagIds, (art.tagIds ?? []).map(Number)) && category === art.category;
        if (!unchanged) {
          try {
            await db.saveArtwork(buildArtworkTaxonomyUpdatePayload(art, tagIds, category));
          } catch (e) {
            failed += 1;
            pushLog(`失敗：${art.title}（${e instanceof Error ? e.message : '未知錯誤'}）`);
          }
          await sleep(DELAY_MS);
        }
        setProgress({ done: i + 1, total: freshArts.length, failed });
      }

      // 3. 停用已沒有作品使用的舊標籤
      const after = await db.getArtworkTags({ admin: true });
      let deactivatedCount = 0;
      for (const key of RETIRED_TAG_KEYS) {
        const tag = after.tags.find((t) => t.tagKey === key);
        if (!tag || !tag.isActive) continue;
        if ((tag.usageCount ?? 0) > 0) {
          pushLog(`保留：${tag.displayName}（仍有 ${tag.usageCount} 件作品使用）`);
          continue;
        }
        await db.toggleArtworkTag(tag.id, false);
        deactivatedCount += 1;
      }
      pushLog(`已停用 ${deactivatedCount} 個舊標籤`);

      // 4. 依新順序排列
      for (const group of ['subject', 'style'] as const) {
        const ordered = NEW_TAGS.filter((t) => t.group === group).map((t) => idByKey[t.tagKey]);
        const rest = after.tags.filter((t) => t.groupKey === group && !ordered.includes(t.id)).map((t) => t.id);
        await db.reorderArtworkTags(group, [...ordered, ...rest]);
      }

      pushLog(failed > 0 ? `完成，但有 ${failed} 件失敗，可以再按一次「套用」重試` : '全部完成');
      setPhase('done');
      onFinished();
    } catch (e) {
      console.error(e);
      pushLog(`中斷：${e instanceof Error ? e.message : '未知錯誤'}`);
      setPhase('done');
    }
  };

  const revert = async () => {
    if (!backup) return;
    if (!window.confirm('要把所有作品的分類和標籤名稱換回整理前的狀態嗎？')) return;
    setPhase('reverting');
    try {
      // 先恢復標籤（重新啟用、改回原名），作品才能存回舊標籤
      for (const t of backup.tags) {
        if (t.isActive) await db.toggleArtworkTag(t.id, true);
      }
      const current = await db.getArtworkTags({ admin: true });
      for (const t of backup.tags) {
        const now = current.tags.find((c) => c.id === t.id);
        if (now && now.displayName !== t.displayName) await db.updateArtworkTag(t.id, t.displayName);
      }
      const freshArts = await db.getAdminArtworks();
      const byId = Object.fromEntries(freshArts.map((a) => [a.id, a]));
      setProgress({ done: 0, total: backup.artworks.length, failed: 0 });
      let failed = 0;
      for (let i = 0; i < backup.artworks.length; i += 1) {
        const old = backup.artworks[i];
        const art = byId[old.id];
        if (art) {
          try {
            await db.saveArtwork(buildArtworkTaxonomyUpdatePayload(art, old.tagIds, old.category));
          } catch {
            failed += 1;
          }
          await sleep(DELAY_MS);
        }
        setProgress({ done: i + 1, total: backup.artworks.length, failed });
      }
      for (const t of backup.tags) {
        if (!t.isActive) await db.toggleArtworkTag(t.id, false);
      }
      pushLog(failed > 0 ? `復原完成，但有 ${failed} 件失敗` : '已全部復原');
      setBackup(null);
    } catch (e) {
      pushLog(`復原中斷：${e instanceof Error ? e.message : '未知錯誤'}`);
    }
    setPhase('done');
    onFinished();
  };

  const handleClose = () => {
    if (busy) return;
    loadedRef.current = false;
    onClose();
  };

  if (!open) return null;

  const selectClass = 'w-full bg-dark border border-white/10 rounded-md text-xs text-gray-200 px-2 py-1.5 focus:border-primary focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-stretch justify-center p-2 md:p-6">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-6xl flex flex-col min-h-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Tags size={18} className="text-primary" /> 分類整理（題材 7 ＋ 風格 4）
          </h3>
          <button type="button" onClick={handleClose} disabled={busy} className="text-gray-400 hover:text-white disabled:opacity-30">
            <X size={20} />
          </button>
        </div>

        {phase === 'loading' && <p className="p-8 text-center text-gray-400">讀取作品與標籤中…</p>}
        {phase === 'error' && (
          <div className="p-8 text-center space-y-3">
            <p className="text-red-400">{error}</p>
            <button type="button" onClick={() => void load()} className="px-4 py-2 rounded-lg border border-white/20 text-gray-200">重試</button>
          </div>
        )}

        {phase === 'review' && (
          <>
            <div className="px-5 py-3 border-b border-white/10 space-y-2 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {NEW_TAGS.map((t) => (
                  <span key={t.tagKey} className={`px-2 py-1 rounded-full border ${t.group === 'subject' ? 'border-white/15 text-gray-200' : 'border-primary/40 text-primary'}`}>
                    {t.name} {counts[t.tagKey] ?? 0}
                  </span>
                ))}
              </div>
              <p className="text-gray-500">
                每件作品已依原本標籤與看圖結果預先選好。標示「請確認」的是規則無法判斷或我依圖片人工判斷的，建議看一下。
                「很想刺」會保留在作品上（之後做推薦按鈕用），其他舊標籤整理後停用。
              </p>
              <div className="flex gap-2">
                {([['review', `請確認（${reviewCount}）`], ['all', `全部（${artworks.length}）`]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-full border ${view === v ? 'bg-primary/15 border-primary text-primary' : 'border-white/10 text-gray-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {visible.map((art) => {
                  const ch = choices[art.id];
                  const src = resolvePublicAssetUrl(art.cardImageUrl || art.imageUrls?.[0] || art.imageUrl, currentAdminBrand) || art.imageUrl;
                  return (
                    <div key={art.id} className={`rounded-lg border p-2 space-y-1.5 ${ch?.needsReview ? 'border-amber-400/50' : 'border-white/10'}`}>
                      <div className="bg-white rounded aspect-square overflow-hidden">
                        <img src={src} alt={art.title} loading="lazy" className="w-full h-full object-contain" />
                      </div>
                      <p className="text-xs text-white truncate" title={art.title}>{art.title}</p>
                      <p className="text-[10px] text-gray-500 truncate" title={oldNamesOf(art)}>原本：{oldNamesOf(art) || '（無）'}</p>
                      <select
                        className={selectClass}
                        value={ch?.subject ?? ''}
                        onChange={(e) => setChoice(art.id, { subject: e.target.value || null })}
                      >
                        <option value="">— 題材 —</option>
                        {SUBJECT_OPTIONS.map((o) => <option key={o.tagKey} value={o.tagKey}>{o.name}</option>)}
                      </select>
                      <select
                        className={selectClass}
                        value={ch?.style ?? ''}
                        onChange={(e) => setChoice(art.id, { style: e.target.value || null })}
                      >
                        <option value="">— 風格 —</option>
                        {STYLE_OPTIONS.map((o) => <option key={o.tagKey} value={o.tagKey}>{o.name}</option>)}
                      </select>
                      {ch?.needsReview && <p className="text-[10px] text-amber-300">請確認</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-white/10 flex flex-wrap items-center justify-end gap-3">
              {missingCount > 0 && <p className="text-xs text-amber-300 mr-auto">還有 {missingCount} 件未選完</p>}
              <button
                type="button"
                onClick={apply}
                className="bg-primary text-black font-bold px-5 py-2.5 rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm"
              >
                <Play size={16} /> 套用到 {artworks.length} 件作品
              </button>
            </div>
          </>
        )}

        {(phase === 'applying' || phase === 'reverting' || phase === 'done') && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-5 py-4 space-y-2">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {phase === 'reverting' ? '復原中' : phase === 'applying' ? '套用中' : '已結束'}：{progress.done} / {progress.total}
                {progress.failed > 0 && <span className="text-red-400"> · 失敗 {progress.failed}</span>}
              </p>
              {busy && <p className="text-xs text-amber-300/90">處理中請勿關閉或重新整理此頁</p>}
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto px-5 text-xs text-gray-300 space-y-1">
              {log.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
            {phase === 'done' && (
              <div className="px-5 py-4 border-t border-white/10 flex flex-wrap justify-end gap-2">
                {backup && (
                  <>
                    <button
                      type="button"
                      onClick={() => downloadJson(backup, `inkflow-taxonomy-backup-${Date.now()}.json`)}
                      className="border border-white/20 text-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                    >
                      <Download size={14} /> 再下載一次備份
                    </button>
                    <button
                      type="button"
                      onClick={revert}
                      className="border border-white/20 text-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                    >
                      <RotateCcw size={14} /> 復原
                    </button>
                  </>
                )}
                <button type="button" onClick={handleClose} className="bg-primary text-black font-bold px-4 py-2 rounded-lg text-sm">
                  完成
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaxonomyMigrationPanel;
