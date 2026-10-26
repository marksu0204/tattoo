import { describe, expect, it } from 'vitest';
import { GUJIGUJI_CONFIG, WHITEHORN_CONFIG } from '../config/brands';
import {
  resolvePublicAssetUrl,
  resolveSharedUploadTargetOrigin,
} from './publicAssetUrl';

const GUJIGUJI_PUBLIC = 'https://gujiguji.inkflow.work';
const WHITEHORN_PUBLIC = 'https://inkflow.work';

describe('resolveSharedUploadTargetOrigin', () => {
  it('prefers trusted runtime origin over brand publicOrigin', () => {
    expect(resolveSharedUploadTargetOrigin(GUJIGUJI_CONFIG, WHITEHORN_PUBLIC)).toBe(
      WHITEHORN_PUBLIC,
    );
  });

  it('falls back to brand publicOrigin when runtime is localhost (DEV)', () => {
    expect(resolveSharedUploadTargetOrigin(GUJIGUJI_CONFIG, 'http://localhost:5173')).toBe(
      GUJIGUJI_PUBLIC,
    );
  });
});

describe('resolvePublicAssetUrl', () => {
  it('A: public gujiguji runtime rewrites inkflow.work shared upload', () => {
    expect(
      resolvePublicAssetUrl(
        'https://inkflow.work/uploads/a.webp',
        GUJIGUJI_CONFIG,
        GUJIGUJI_PUBLIC,
      ),
    ).toBe(`${GUJIGUJI_PUBLIC}/uploads/a.webp`);
  });

  it('B: admin inkflow.work runtime rewrites gujiguji shared upload to inkflow.work', () => {
    expect(
      resolvePublicAssetUrl(
        'https://gujiguji.inkflow.work/uploads/a.webp',
        GUJIGUJI_CONFIG,
        WHITEHORN_PUBLIC,
      ),
    ).toBe(`${WHITEHORN_PUBLIC}/uploads/a.webp`);
  });

  it('C: admin inkflow.work runtime keeps inkflow.work shared upload unchanged', () => {
    const url = `${WHITEHORN_PUBLIC}/uploads/a.webp`;
    expect(resolvePublicAssetUrl(url, GUJIGUJI_CONFIG, WHITEHORN_PUBLIC)).toBe(url);
  });

  it('D: external URL is unchanged', () => {
    const external = 'https://cdn.example.com/image.jpg';
    expect(resolvePublicAssetUrl(external, GUJIGUJI_CONFIG, GUJIGUJI_PUBLIC)).toBe(external);
    expect(resolvePublicAssetUrl(external, GUJIGUJI_CONFIG, WHITEHORN_PUBLIC)).toBe(external);
  });

  it('E: non-/uploads/ INKFLOW URL is unchanged', () => {
    const pageUrl = `${WHITEHORN_PUBLIC}/artwork/123`;
    expect(resolvePublicAssetUrl(pageUrl, GUJIGUJI_CONFIG, GUJIGUJI_PUBLIC)).toBe(pageUrl);
    expect(resolvePublicAssetUrl(pageUrl, GUJIGUJI_CONFIG, WHITEHORN_PUBLIC)).toBe(pageUrl);
  });

  it('F: preserves query and hash when rewriting shared upload URL', () => {
    expect(
      resolvePublicAssetUrl(
        'https://inkflow.work/uploads/a.webp?v=2#section',
        GUJIGUJI_CONFIG,
        GUJIGUJI_PUBLIC,
      ),
    ).toBe(`${GUJIGUJI_PUBLIC}/uploads/a.webp?v=2#section`);
  });

  it('gujiguji relative /uploads/ uses runtime origin on public site', () => {
    expect(resolvePublicAssetUrl('/uploads/a.webp', GUJIGUJI_CONFIG, GUJIGUJI_PUBLIC)).toBe(
      `${GUJIGUJI_PUBLIC}/uploads/a.webp`,
    );
  });

  it('gujiguji relative /uploads/ uses inkflow.work on admin runtime', () => {
    expect(resolvePublicAssetUrl('/uploads/a.webp', GUJIGUJI_CONFIG, WHITEHORN_PUBLIC)).toBe(
      `${WHITEHORN_PUBLIC}/uploads/a.webp`,
    );
  });

  it('whitehorn public runtime keeps inkflow.work shared upload unchanged', () => {
    const url = `${WHITEHORN_PUBLIC}/uploads/a.webp`;
    expect(resolvePublicAssetUrl(url, WHITEHORN_CONFIG, WHITEHORN_PUBLIC)).toBe(url);
  });

  it('without runtime origin falls back to brand publicOrigin (SSR/test)', () => {
    expect(resolvePublicAssetUrl('https://inkflow.work/uploads/a.webp', GUJIGUJI_CONFIG)).toBe(
      `${GUJIGUJI_PUBLIC}/uploads/a.webp`,
    );
  });

  it('localhost DEV falls back to brand publicOrigin for shared upload rewrite', () => {
    expect(
      resolvePublicAssetUrl(
        'https://inkflow.work/uploads/a.webp',
        GUJIGUJI_CONFIG,
        'http://localhost:5173',
      ),
    ).toBe(`${GUJIGUJI_PUBLIC}/uploads/a.webp`);
  });

  it('empty or null URL returns safe empty string', () => {
    expect(resolvePublicAssetUrl(null, GUJIGUJI_CONFIG, GUJIGUJI_PUBLIC)).toBe('');
    expect(resolvePublicAssetUrl(undefined, GUJIGUJI_CONFIG, GUJIGUJI_PUBLIC)).toBe('');
    expect(resolvePublicAssetUrl('', GUJIGUJI_CONFIG, GUJIGUJI_PUBLIC)).toBe('');
    expect(resolvePublicAssetUrl('   ', GUJIGUJI_CONFIG, GUJIGUJI_PUBLIC)).toBe('');
  });
});
