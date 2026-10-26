import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GUJIGUJI_CONFIG, WHITEHORN_CONFIG } from '../config/brands';
import { applyBrandTheme } from './brandTheme';

describe('applyBrandTheme', () => {
  const styleStore = new Map<string, string>();
  const setProperty = vi.fn((name: string, value: string) => {
    styleStore.set(name, value);
  });
  const getPropertyValue = vi.fn((name: string) => styleStore.get(name) ?? '');

  beforeEach(() => {
    styleStore.clear();
    setProperty.mockClear();
    getPropertyValue.mockClear();
    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty,
          getPropertyValue,
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets CSS variables from brand primary/accent colors', () => {
    applyBrandTheme(WHITEHORN_CONFIG);
    expect(setProperty).toHaveBeenCalledWith('--brand-primary', '#d4af37');
    expect(setProperty).toHaveBeenCalledWith('--brand-accent', '#121212');
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#d4af37');
    expect(document.documentElement.style.getPropertyValue('--brand-accent')).toBe('#121212');

    applyBrandTheme(GUJIGUJI_CONFIG);
    expect(setProperty).toHaveBeenCalledWith('--brand-primary', '#f4a7b9');
    expect(setProperty).toHaveBeenCalledWith('--brand-accent', '#1a1a2e');
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#f4a7b9');
    expect(document.documentElement.style.getPropertyValue('--brand-accent')).toBe('#1a1a2e');
  });

  it('updates CSS variables when DB-merged colors change', () => {
    const dbMerged = { ...GUJIGUJI_CONFIG, primaryColor: '#ff0000', accentColor: '#0000ff' };
    applyBrandTheme(dbMerged);
    expect(setProperty).toHaveBeenCalledWith('--brand-primary', '#ff0000');
    expect(setProperty).toHaveBeenCalledWith('--brand-accent', '#0000ff');
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#ff0000');
    expect(document.documentElement.style.getPropertyValue('--brand-accent')).toBe('#0000ff');
  });
});
