import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Plus, Power, Trash2, X } from 'lucide-react';
import { db } from '../services/mockBackend';
import type { ArtworkTagGroup, ArtworkTaxonomyTag } from '../types';
import { ARTWORK_TAG_GROUP_LABELS, ARTWORK_TAG_GROUPS } from '../utils/artworkTaxonomy';

interface ArtworkTaxonomyManagerProps {
  onClose: () => void;
}

const ArtworkTaxonomyManager: React.FC<ArtworkTaxonomyManagerProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [tagsByGroup, setTagsByGroup] = useState<Record<ArtworkTagGroup, ArtworkTaxonomyTag[]>>({
    subject: [],
    style: [],
    format: [],
    campaign: [],
  });
  const [newTagNames, setNewTagNames] = useState<Record<ArtworkTagGroup, string>>({
    subject: '',
    style: '',
    format: '',
    campaign: '',
  });
  const [editingTag, setEditingTag] = useState<ArtworkTaxonomyTag | null>(null);
  const [editingName, setEditingName] = useState('');

  const loadTags = async () => {
    setLoading(true);
    try {
      const data = await db.getArtworkTags({ admin: true });
      setTagsByGroup(data.tagsByGroup);
    } catch (e) {
      console.error(e);
      alert('載入分類標籤失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleCreate = async (groupKey: ArtworkTagGroup) => {
    const displayName = newTagNames[groupKey].trim();
    if (!displayName) return;
    try {
      await db.createArtworkTag({ groupKey, displayName });
      setNewTagNames((prev) => ({ ...prev, [groupKey]: '' }));
      await loadTags();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '新增失敗');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTag) return;
    const displayName = editingName.trim();
    if (!displayName) return;
    try {
      await db.updateArtworkTag(editingTag.id, displayName);
      setEditingTag(null);
      setEditingName('');
      await loadTags();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '更新失敗');
    }
  };

  const handleToggle = async (tag: ArtworkTaxonomyTag) => {
    try {
      await db.toggleArtworkTag(tag.id, !tag.isActive);
      await loadTags();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '狀態更新失敗');
    }
  };

  const handleDelete = async (tag: ArtworkTaxonomyTag) => {
    if ((tag.usageCount ?? 0) > 0) {
      alert('此標籤已有作品使用，請改用「停用」。');
      return;
    }
    if (!window.confirm(`確定刪除「${tag.displayName}」？`)) return;
    try {
      await db.deleteArtworkTag(tag.id);
      await loadTags();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  const moveTag = async (groupKey: ArtworkTagGroup, tagId: number, direction: -1 | 1) => {
    const list = [...tagsByGroup[groupKey]];
    const index = list.findIndex((tag) => tag.id === tagId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    try {
      await db.reorderArtworkTags(groupKey, list.map((tag) => tag.id));
      await loadTags();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '排序失敗');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 flex flex-col">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">管理分類</h3>
            <p className="text-xs text-gray-500 mt-1">四個維度固定；標籤可新增、改名、排序、停用</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <p className="text-gray-400 text-sm">載入中...</p>
          ) : (
            ARTWORK_TAG_GROUPS.map((groupKey) => (
              <section key={groupKey} className="rounded-xl border border-white/10 bg-dark/40 p-4">
                <h4 className="text-sm font-bold text-primary mb-3">{ARTWORK_TAG_GROUP_LABELS[groupKey]}</h4>
                <ul className="space-y-2 mb-3">
                  {tagsByGroup[groupKey].map((tag, index) => (
                    <li
                      key={tag.id}
                      className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                        tag.isActive ? 'bg-white/5' : 'bg-black/20 opacity-60'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-white">{tag.displayName}</span>
                        <span className="text-gray-500 text-xs ml-2">{tag.usageCount ?? 0} 件</span>
                        {!tag.isActive && <span className="text-amber-400 text-xs ml-2">已停用</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => moveTag(groupKey, tag.id, -1)} disabled={index === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-30"><ChevronUp size={14} /></button>
                        <button type="button" onClick={() => moveTag(groupKey, tag.id, 1)} disabled={index === tagsByGroup[groupKey].length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-30"><ChevronDown size={14} /></button>
                        <button type="button" onClick={() => { setEditingTag(tag); setEditingName(tag.displayName); }} className="p-1 text-gray-400 hover:text-white"><Edit2 size={14} /></button>
                        <button type="button" onClick={() => handleToggle(tag)} className="p-1 text-gray-400 hover:text-white" title={tag.isActive ? '停用' : '啟用'}><Power size={14} /></button>
                        <button type="button" onClick={() => handleDelete(tag)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input
                    value={newTagNames[groupKey]}
                    onChange={(e) => setNewTagNames((prev) => ({ ...prev, [groupKey]: e.target.value }))}
                    placeholder={`新增${ARTWORK_TAG_GROUP_LABELS[groupKey]}標籤`}
                    className="flex-1 bg-dark border border-gray-700 rounded px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreate(groupKey)}
                    className="bg-primary text-black px-3 rounded font-bold text-sm flex items-center gap-1"
                  >
                    <Plus size={14} /> 新增
                  </button>
                </div>
              </section>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 shrink-0">
          <button onClick={onClose} className="w-full text-gray-400 text-sm hover:text-white">關閉</button>
        </div>
      </div>

      {editingTag && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-card border border-white/10 rounded-xl p-5 w-full max-w-sm">
            <h4 className="text-white font-bold mb-3">編輯標籤名稱</h4>
            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="w-full bg-dark border border-gray-700 rounded px-3 py-2 text-white mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setEditingTag(null); setEditingName(''); }} className="flex-1 py-2 rounded border border-gray-700 text-gray-300">取消</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2 rounded bg-primary text-black font-bold">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtworkTaxonomyManager;
