import { describe, expect, it } from 'vitest';
import {
  blocksToApiPayload,
  createImageBlock,
  createTextBlock,
  validateMessageBlocks,
  broadcastMessageDisplaySummary,
} from './lineBroadcastMessages';
import type { LineBroadcast } from '../types';

describe('lineBroadcastMessages', () => {
  it('validates text block', () => {
    expect(validateMessageBlocks([createTextBlock('hello')])).toBeNull();
    expect(validateMessageBlocks([createTextBlock('   ')])).toBeTruthy();
  });

  it('rejects more than 3 blocks', () => {
    const blocks = [createTextBlock('a'), createTextBlock('b'), createTextBlock('c'), createTextBlock('d')];
    expect(validateMessageBlocks(blocks)).toContain('最多 3');
  });

  it('serializes blocks for API', () => {
    const blocks = [
      createTextBlock('first'),
      { ...createImageBlock({ originalUrl: 'https://x.com/a.jpg', previewUrl: 'https://x.com/a_p.jpg' }), imageUrl: 'https://x.com/a.jpg', previewImageUrl: 'https://x.com/a_p.jpg' },
    ];
    const payload = blocksToApiPayload(blocks);
    expect(payload[0]).toEqual({ type: 'text', text: 'first' });
    expect(payload[1].type).toBe('image');
  });

  it('displays legacy broadcast summary', () => {
    const bc: LineBroadcast = {
      id: 1,
      title: 't',
      content: 'legacy text',
      filterType: 'all',
      filterTags: [],
      sentAt: new Date().toISOString(),
      totalCount: 1,
      clickCount: 0,
      openRate: 0,
    };
    const summary = broadcastMessageDisplaySummary(bc);
    expect(summary.count).toBe(1);
    expect(summary.lines[0]).toContain('文字');
  });
});
