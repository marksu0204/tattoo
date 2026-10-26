import React, { useRef, useState } from 'react';
import {
  ChevronDown, ChevronUp, Image, Link, CheckCircle,
} from 'lucide-react';
import type { Artwork, LineBroadcastImageEntry, LineCarouselItem } from '../types';
import { validateBroadcastImageFile, validateClickLinkUrl } from '../utils/lineAudienceSummary';
import {
  createCarouselItem,
  formatLinkDisplay,
  MAX_CAROUSEL_ITEMS,
  normalizeCarouselOrder,
} from '../utils/lineCarousel';
import {
  MAX_MESSAGE_BLOCKS,
  type MessageBlockState,
} from '../utils/lineBroadcastMessages';

type UploadTarget =
  | { kind: 'block-image'; blockId: string }
  | { kind: 'carousel-add'; blockId: string }
  | { kind: 'carousel-replace'; blockId: string; itemId: string };

export const LineBroadcastMessageBlocks: React.FC<{
  blocks: MessageBlockState[];
  onChange: (blocks: MessageBlockState[]) => void;
  trackingUrl: string;
  onTrackingUrlChange: (url: string) => void;
  showClickLink: boolean;
  onShowClickLinkChange: (open: boolean) => void;
  imageUploading: boolean;
  onUploadImage: (file: File) => Promise<LineBroadcastImageEntry>;
  onPickArtwork: (blockId: string, itemId: string) => void;
}> = ({
  blocks,
  onChange,
  trackingUrl,
  onTrackingUrlChange,
  showClickLink,
  onShowClickLinkChange,
  imageUploading,
  onUploadImage,
  onPickArtwork,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [advancedUrlByBlock, setAdvancedUrlByBlock] = useState<Record<string, string>>({});
  const [showAdvancedUrl, setShowAdvancedUrl] = useState<Record<string, boolean>>({});

  const triggerUpload = (target: UploadTarget) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const updateBlock = (id: string, patch: Partial<MessageBlockState>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } as MessageBlockState : b)));
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) return;
    onChange(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const next = [...blocks];
    const swap = idx + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const addBlock = (type: MessageBlockState['type']) => {
    if (blocks.length >= MAX_MESSAGE_BLOCKS) return;
    if (type === 'text') {
      onChange([...blocks, { id: crypto.randomUUID(), type: 'text', text: '' }]);
    } else if (type === 'image') {
      onChange([...blocks, { id: crypto.randomUUID(), type: 'image', imageUrl: '', previewImageUrl: '' }]);
    } else {
      onChange([...blocks, { id: crypto.randomUUID(), type: 'carousel', items: [] }]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadTarget) return;
    const fileErr = validateBroadcastImageFile(file);
    if (fileErr) return;

    try {
      const entry = await onUploadImage(file);
      if (uploadTarget.kind === 'block-image') {
        updateBlock(uploadTarget.blockId, {
          imageUrl: entry.originalUrl,
          previewImageUrl: entry.previewUrl,
        });
      } else if (uploadTarget.kind === 'carousel-add') {
        const block = blocks.find((b) => b.id === uploadTarget.blockId);
        if (block?.type === 'carousel') {
          if (block.items.length >= MAX_CAROUSEL_ITEMS) return;
          updateBlock(uploadTarget.blockId, {
            items: normalizeCarouselOrder([
              ...block.items,
              createCarouselItem(entry, block.items.length),
            ]),
          });
        }
      } else if (uploadTarget.kind === 'carousel-replace') {
        const block = blocks.find((b) => b.id === uploadTarget.blockId);
        if (block?.type === 'carousel') {
          updateBlock(uploadTarget.blockId, {
            items: block.items.map((item) => (
              item.id === uploadTarget.itemId
                ? { ...item, originalUrl: entry.originalUrl, previewUrl: entry.previewUrl }
                : item
            )),
          });
        }
      }
    } finally {
      setUploadTarget(null);
    }
  };

  const updateCarouselItem = (blockId: string, itemId: string, patch: Partial<LineCarouselItem>) => {
    const block = blocks.find((b) => b.id === blockId);
    if (block?.type !== 'carousel') return;
    updateBlock(blockId, {
      items: block.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  };

  const removeCarouselItem = (blockId: string, itemId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (block?.type !== 'carousel') return;
    updateBlock(blockId, {
      items: normalizeCarouselOrder(block.items.filter((item) => item.id !== itemId)),
    });
  };

  const moveCarouselItem = (blockId: string, itemId: string, direction: -1 | 1) => {
    const block = blocks.find((b) => b.id === blockId);
    if (block?.type !== 'carousel') return;
    const idx = block.items.findIndex((item) => item.id === itemId);
    if (idx < 0) return;
    const next = [...block.items];
    const swap = idx + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    updateBlock(blockId, { items: normalizeCarouselOrder(next) });
  };

  const applyAdvancedImageUrl = (blockId: string) => {
    const url = (advancedUrlByBlock[blockId] ?? '').trim();
    if (!url.startsWith('https://')) return;
    updateBlock(blockId, { imageUrl: url, previewImageUrl: url });
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">最多 {MAX_MESSAGE_BLOCKS} 則</p>
        <p className="text-xs text-primary font-medium">目前 {blocks.length} / {MAX_MESSAGE_BLOCKS}</p>
      </div>

      {blocks.map((block, idx) => (
        <div key={block.id} className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-white text-sm font-medium">訊息 {idx + 1}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={block.type}
                onChange={(e) => {
                  const type = e.target.value as MessageBlockState['type'];
                  if (type === block.type) return;
                  const replacement: MessageBlockState =
                    type === 'text'
                      ? { id: block.id, type: 'text', text: '' }
                      : type === 'image'
                        ? { id: block.id, type: 'image', imageUrl: '', previewImageUrl: '' }
                        : { id: block.id, type: 'carousel', items: [] };
                  onChange(blocks.map((b) => (b.id === block.id ? replacement : b)));
                }}
                className="text-xs bg-dark border border-gray-600 rounded-lg px-2 py-1 text-white"
              >
                <option value="text">文字</option>
                <option value="image">圖片</option>
                <option value="carousel">輪播</option>
              </select>
              <button type="button" disabled={idx === 0} onClick={() => moveBlock(block.id, -1)} className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 disabled:opacity-40">↑</button>
              <button type="button" disabled={idx === blocks.length - 1} onClick={() => moveBlock(block.id, 1)} className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 disabled:opacity-40">↓</button>
              <button type="button" disabled={blocks.length <= 1} onClick={() => removeBlock(block.id)} className="text-xs px-2 py-1 rounded bg-gray-700 text-red-300 disabled:opacity-40">刪除</button>
            </div>
          </div>

          {block.type === 'text' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">訊息文字 <span className="text-gray-500">{block.text.length}/2000</span></label>
              <textarea
                value={block.text}
                onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                rows={4}
                maxLength={2000}
                className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-2 text-white text-sm resize-none"
                placeholder="輸入訊息內容…"
              />
            </div>
          )}

          {block.type === 'image' && (
            <div className="space-y-2">
              {block.imageUrl ? (
                <>
                  <div className="rounded-lg overflow-hidden border border-gray-700 max-h-40">
                    <img src={block.previewImageUrl || block.imageUrl} alt="" className="w-full max-h-40 object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={imageUploading} onClick={() => triggerUpload({ kind: 'block-image', blockId: block.id })} className="text-xs px-3 py-1.5 rounded bg-gray-700 text-gray-200 disabled:opacity-50">更換</button>
                    <button type="button" disabled={imageUploading} onClick={() => updateBlock(block.id, { imageUrl: '', previewImageUrl: '' })} className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-300">刪除圖片</button>
                  </div>
                </>
              ) : (
                <button type="button" disabled={imageUploading} onClick={() => triggerUpload({ kind: 'block-image', blockId: block.id })} className="text-sm px-4 py-2 rounded-lg border border-gray-600 text-gray-200 hover:border-primary/40 disabled:opacity-50">
                  {imageUploading ? '上傳中…' : '選擇圖片'}
                </button>
              )}
              <button type="button" onClick={() => setShowAdvancedUrl((prev) => ({ ...prev, [block.id]: !prev[block.id] }))} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400">
                {showAdvancedUrl[block.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 進階：使用圖片網址
              </button>
              {showAdvancedUrl[block.id] && (
                <div className="flex gap-2">
                  <input
                    value={advancedUrlByBlock[block.id] ?? ''}
                    onChange={(e) => setAdvancedUrlByBlock((prev) => ({ ...prev, [block.id]: e.target.value }))}
                    placeholder="HTTPS 圖片網址"
                    className="flex-1 bg-dark border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button type="button" onClick={() => applyAdvancedImageUrl(block.id)} className="text-xs px-2 py-1 rounded bg-gray-700">套用</button>
                </div>
              )}
            </div>
          )}

          {block.type === 'carousel' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-400 flex items-center gap-1"><Image size={12} />輪播（最多 {MAX_CAROUSEL_ITEMS} 張）</label>
                <button
                  type="button"
                  disabled={imageUploading || block.items.length >= MAX_CAROUSEL_ITEMS}
                  onClick={() => triggerUpload({ kind: 'carousel-add', blockId: block.id })}
                  className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 disabled:opacity-50"
                >
                  ＋ 新增圖片
                </button>
              </div>
              {block.items.map((item, itemIdx) => (
                <div key={item.id} className="p-3 rounded-xl bg-gray-800/80 border border-gray-700 space-y-3">
                  <div className="flex items-start gap-3">
                    <img src={item.previewUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-700" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium mb-1">圖片 {itemIdx + 1}</p>
                      <label className="block text-xs text-gray-400 mb-1">點擊後前往（選填）</label>
                      <input
                        value={item.targetUrl ?? ''}
                        onChange={(e) => updateCarouselItem(block.id, item.id, { targetUrl: e.target.value })}
                        placeholder="https://inkflow.work/artwork/..."
                        className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm"
                      />
                      {item.targetUrl?.trim() && !validateClickLinkUrl(item.targetUrl) && (
                        <p className="text-xs text-green-400/90 mt-1 flex items-center gap-1"><CheckCircle size={12} /> 系統將統計此圖片點擊次數</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onPickArtwork(block.id, item.id)} className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300">選擇作品</button>
                    <button type="button" disabled={imageUploading} onClick={() => triggerUpload({ kind: 'carousel-replace', blockId: block.id, itemId: item.id })} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 disabled:opacity-50">更換</button>
                    <button type="button" disabled={itemIdx === 0} onClick={() => moveCarouselItem(block.id, item.id, -1)} className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 disabled:opacity-40">上移</button>
                    <button type="button" disabled={itemIdx === block.items.length - 1} onClick={() => moveCarouselItem(block.id, item.id, 1)} className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 disabled:opacity-40">下移</button>
                    <button type="button" onClick={() => removeCarouselItem(block.id, item.id)} className="text-xs px-2 py-1 rounded bg-gray-700 text-red-300">刪除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={blocks.length >= MAX_MESSAGE_BLOCKS} onClick={() => addBlock('text')} className="text-sm px-3 py-2 rounded-lg border border-gray-600 text-gray-200 disabled:opacity-40">+ 新增文字</button>
        <button type="button" disabled={blocks.length >= MAX_MESSAGE_BLOCKS} onClick={() => addBlock('image')} className="text-sm px-3 py-2 rounded-lg border border-gray-600 text-gray-200 disabled:opacity-40">+ 新增圖片</button>
        <button type="button" disabled={blocks.length >= MAX_MESSAGE_BLOCKS} onClick={() => addBlock('carousel')} className="text-sm px-3 py-2 rounded-lg border border-gray-600 text-gray-200 disabled:opacity-40">+ 新增輪播</button>
      </div>

      {!showClickLink ? (
        <button type="button" onClick={() => onShowClickLinkChange(true)} className="flex items-center gap-1 text-sm text-primary">
          <Link size={14} /> ＋ 加入點擊連結（附加於最後一則文字）
        </button>
      ) : (
        <div className="p-3 rounded-lg border border-gray-700/60 bg-gray-900/40 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-white">點擊連結（選填）</label>
            <button type="button" onClick={() => { onShowClickLinkChange(false); onTrackingUrlChange(''); }} className="text-xs text-gray-400 hover:text-white">移除連結</button>
          </div>
          <p className="text-xs text-gray-400">若有文字訊息，連結會附加在最後一則文字末尾；否則以獨立文字訊息送出。</p>
          <input
            type="url"
            value={trackingUrl}
            onChange={(e) => onTrackingUrlChange(e.target.value)}
            placeholder="例如：作品詳細頁 / 作品集頁"
            className="w-full bg-dark border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          />
          {trackingUrl.trim() && formatLinkDisplay(trackingUrl) && (
            <p className="text-xs text-gray-500">{formatLinkDisplay(trackingUrl)}</p>
          )}
        </div>
      )}
    </div>
  );
};

export type { Artwork };
