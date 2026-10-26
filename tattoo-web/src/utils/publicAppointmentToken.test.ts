import { describe, expect, it } from 'vitest';
import {
  buildPublicAppointmentUrl,
  buildPublicConsentUrl,
  parsePublicAppointmentTokenFromHash,
  validatePublicAppointmentToken,
  isSensitivePublicAppointmentLocation,
} from './publicAppointmentToken';

const VALID_TOKEN = 'a'.repeat(64);

describe('publicAppointmentToken', () => {
  it('accepts valid 64 hex hash token', () => {
    expect(parsePublicAppointmentTokenFromHash(`#t=${VALID_TOKEN}`)).toBe(VALID_TOKEN);
  });

  it('returns null when hash missing', () => {
    expect(parsePublicAppointmentTokenFromHash('')).toBeNull();
    expect(parsePublicAppointmentTokenFromHash('#')).toBeNull();
  });

  it('rejects malformed token', () => {
    expect(parsePublicAppointmentTokenFromHash('#t=abc')).toBeNull();
    expect(parsePublicAppointmentTokenFromHash('#t=ZZZZ')).toBeNull();
  });

  it('rejects wrong length token', () => {
    expect(validatePublicAppointmentToken('a'.repeat(63))).toBe(false);
    expect(validatePublicAppointmentToken('a'.repeat(65))).toBe(false);
  });

  it('builds hash URLs without query string', () => {
    expect(buildPublicAppointmentUrl('https://inkflow.work', VALID_TOKEN)).toBe(
      `https://inkflow.work/appointment#t=${VALID_TOKEN}`,
    );
    expect(buildPublicConsentUrl('https://inkflow.work/', VALID_TOKEN)).toBe(
      `https://inkflow.work/consent#t=${VALID_TOKEN}`,
    );
    expect(buildPublicAppointmentUrl('https://inkflow.work', VALID_TOKEN)).not.toContain('?');
  });

  it('flags sensitive public appointment/consent locations', () => {
    expect(isSensitivePublicAppointmentLocation('/appointment', `#t=${VALID_TOKEN}`)).toBe(true);
    expect(isSensitivePublicAppointmentLocation('/consent', `#t=${VALID_TOKEN}`)).toBe(true);
    expect(isSensitivePublicAppointmentLocation('/appointment', '')).toBe(false);
    expect(isSensitivePublicAppointmentLocation('/', `#t=${VALID_TOKEN}`)).toBe(false);
  });
});
