import type { LineBroadcast, LineBroadcastImageEntry, LineBroadcastMessageBlock, LineCarouselItem } from '../types';
import { validateClickLinkUrl } from './lineAudienceSummary';
import { MAX_CAROUSEL_ITEMS, validateCarouselItems } from './lineCarousel';

export const MAX_MESSAGE_BLOCKS = 3;

export type MessageBlockState =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; imageUrl: string; previewImageUrl: string }
  | { id: string; type: 'carousel'; items: LineCarouselItem[] };

export function createMessageBlockId(): string {
  return crypto.randomUUID();
}

export function createTextBlock(text = ''): MessageBlockState {
  return { id: createMessageBlockId(), type: 'text', text };
}

export function createImageBlock(entry?: LineBroadcastImageEntry): MessageBlockState {
  return {
    id: createMessageBlockId(),
    type: 'image',
    imageUrl: entry?.originalUrl ?? '',
    previewImageUrl: entry?.previewUrl ?? entry?.originalUrl ?? '',
  };
}

export function createCarouselBlock(items: LineCarouselItem[] = []): MessageBlockState {
  return { id: createMessageBlockId(), type: 'carousel', items };
}

export function messageBlockTypeLabel(type: LineBroadcastMessageBlock['type']): string {
  switch (type) {
    case 'text':
      return '文字';
    case 'image':
      return '圖片';
    case 'carousel':
      return '輪播';
    default:
      return type;
  }
}

export function blocksToApiPayload(blocks: MessageBlockState[]): LineBroadcastMessageBlock[] {
  return blocks.map((block) => {
    if (block.type === 'text') {
      return { type: 'text', text: block.text.trim() };
    }
    if (block.type === 'image') {
      return {
        type: 'image',
        imageUrl: block.imageUrl,
        previewImageUrl: block.previewImageUrl || block.imageUrl,
      };
    }
    return { type: 'carousel', items: block.items };
  });
}

export function validateMessageBlocks(blocks: MessageBlockState[], trackingUrl = ''): string | null {
  if (blocks.length === 0) {
    return '至少需要 1 則訊息';
  }
  if (blocks.length > MAX_MESSAGE_BLOCKS) {
    return `訊息區塊最多 ${MAX_MESSAGE_BLOCKS} 則`;
  }

  for (const block of blocks) {
    if (block.type === 'text') {
      if (!block.text.trim()) {
        return '文字訊息不可為空白';
      }
      if (block.text.length > 2000) {
        return '訊息文字不可超過 2000 字';
      }
    } else if (block.type === 'image') {
      if (!block.imageUrl.startsWith('https://') || !(block.previewImageUrl || block.imageUrl).startsWith('https://')) {
        return '圖片必須為 HTTPS 公開網址（請使用上傳功能）';
      }
    } else if (block.type === 'carousel') {
      if (block.items.length === 0) {
        return '輪播訊息至少需要 1 張圖片';
      }
      const carouselErr = validateCarouselItems(block.items);
      if (carouselErr) return carouselErr;
    }
  }

  return validateClickLinkUrl(trackingUrl);
}

export function messageBlocksSummaryLines(blocks: MessageBlockState[]): string[] {
  return blocks.map((block, idx) => {
    const prefix = `${idx + 1}. ${messageBlockTypeLabel(block.type)}`;
    if (block.type === 'text') {
      const preview = block.text.trim().slice(0, 40);
      return `${prefix}\n   ${preview || '（空白）'}`;
    }
    if (block.type === 'image') {
      return `${prefix}\n   [thumbnail]`;
    }
    return `${prefix}\n   ${block.items.length} 張`;
  });
}

export function resolveBroadcastMessagesFromRecord(bc: LineBroadcast): LineBroadcastMessageBlock[] {
  if (Array.isArray(bc.messages) && bc.messages.length > 0) {
    return bc.messages;
  }

  const legacy: LineBroadcastMessageBlock[] = [];
  if (bc.imageUrl) {
    legacy.push({
      type: 'image',
      imageUrl: bc.imageUrl,
      previewImageUrl: bc.imageUrl,
    });
  }
  if (bc.carouselSnapshot?.length) {
    legacy.push({ type: 'carousel', items: bc.carouselSnapshot });
  }
  if (bc.content?.trim()) {
    legacy.push({ type: 'text', text: bc.content.trim() });
  }
  return legacy;
}

export function broadcastMessageDisplaySummary(bc: LineBroadcast): { count: number; lines: string[] } {
  const messages = resolveBroadcastMessagesFromRecord(bc);
  if (messages.length === 0) {
    return { count: 0, lines: ['（無訊息內容）'] };
  }
  const lines = messages.map((block, idx) => {
    const label = messageBlockTypeLabel(block.type);
    if (block.type === 'text') {
      const preview = block.text.trim().slice(0, 48);
      return `${idx + 1}. ${label} — ${preview || '（空白）'}`;
    }
    if (block.type === 'image') {
      return `${idx + 1}. ${label}`;
    }
    return `${idx + 1}. ${label} — ${block.items.length} 張`;
  });
  return { count: messages.length, lines };
}
