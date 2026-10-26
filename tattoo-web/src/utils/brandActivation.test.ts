import { describe, expect, it } from 'vitest';
import type { PublicBrandPresentation } from './mergeBrandPresentation';
import {
  isPublicBrandApiActivationSuccess,
  resolvePublicBrandActivationStatus,
} from './brandActivation';

describe('resolvePublicBrandActivationStatus', () => {
  it('returns unknown_host when hostname is not recognized', () => {
    expect(
      resolvePublicBrandActivationStatus({
        isKnownHost: false,
        loading: false,
        apiValidated: false,
      }),
    ).toBe('unknown_host');
  });

  it('returns loading for known host while API resolves', () => {
    expect(
      resolvePublicBrandActivationStatus({
        isKnownHost: true,
        loading: true,
        apiValidated: false,
      }),
    ).toBe('loading');
  });

  it('returns active when API validated', () => {
    expect(
      resolvePublicBrandActivationStatus({
        isKnownHost: true,
        loading: false,
        apiValidated: true,
      }),
    ).toBe('active');
  });

  it('returns unsupported for known host after failed validation', () => {
    expect(
      resolvePublicBrandActivationStatus({
        isKnownHost: true,
        loading: false,
        apiValidated: false,
      }),
    ).toBe('unsupported');
  });
});

describe('isPublicBrandApiActivationSuccess', () => {
  const whitehornPayload = {
    code: 'whitehorn' as const,
    name: '白角刺青',
    publicOrigin: 'https://inkflow.work',
    primaryColor: '#d4af37',
    accentColor: '#121212',
    seoSiteName: '白角刺青',
    seoDefaultDescription: 'desc',
  };

  it('accepts matching code with valid payload', () => {
    expect(
      isPublicBrandApiActivationSuccess(true, whitehornPayload, 'whitehorn'),
    ).toBe(true);
  });

  it('rejects code mismatch — fail-closed', () => {
    expect(
      isPublicBrandApiActivationSuccess(true, whitehornPayload, 'gujiguji'),
    ).toBe(false);
  });

  it('rejects non-OK response', () => {
    expect(
      isPublicBrandApiActivationSuccess(false, whitehornPayload, 'whitehorn'),
    ).toBe(false);
  });

  it('rejects invalid payload shape', () => {
    expect(
      isPublicBrandApiActivationSuccess(true, { code: 'whitehorn' }, 'whitehorn'),
    ).toBe(false);
  });

  it('rejects payload missing required publicOrigin', () => {
    expect(
      isPublicBrandApiActivationSuccess(
        true,
        {
          code: 'whitehorn',
          name: '白角刺青',
          primaryColor: '#d4af37',
          accentColor: '#121212',
          seoSiteName: '白角刺青',
          seoDefaultDescription: 'desc',
        },
        'whitehorn',
      ),
    ).toBe(false);
  });

  it('narrows valid payload to PublicBrandPresentation for downstream merge', () => {
    const payload: unknown = whitehornPayload;
    if (isPublicBrandApiActivationSuccess(true, payload, 'whitehorn')) {
      const narrowed: PublicBrandPresentation = payload;
      expect(narrowed.code).toBe('whitehorn');
      expect(narrowed.publicOrigin).toBe('https://inkflow.work');
    } else {
      expect.fail('expected activation success to narrow payload');
    }
  });
});
