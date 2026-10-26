import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { isSensitivePublicAppointmentLocation } from './publicAppointmentToken';
import { shouldTrackPublicPageView } from './sensitivePublicRoute';

const VALID_TOKEN = 'b'.repeat(64);

describe('sensitivePublicRoute telemetry guard', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        pathname: '/',
        hash: '',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks page view tracking on tokenized appointment pages', () => {
    window.location.pathname = '/appointment';
    window.location.hash = `#t=${VALID_TOKEN}`;
    expect(isSensitivePublicAppointmentLocation('/appointment', window.location.hash)).toBe(true);
    expect(shouldTrackPublicPageView()).toBe(false);
  });

  it('allows page view tracking on normal pages', () => {
    window.location.pathname = '/';
    window.location.hash = '';
    expect(shouldTrackPublicPageView()).toBe(true);
  });
});
