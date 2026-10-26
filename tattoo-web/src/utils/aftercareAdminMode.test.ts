import { describe, expect, it } from 'vitest';
import {
  canUseAftercareAdminEditMode,
  isAftercareAdminEditRequested,
  shouldShowAftercareAdminEditor,
} from './aftercareAdminMode';

describe('aftercareAdminMode', () => {
  it('detects adminEdit=1 query param', () => {
    expect(isAftercareAdminEditRequested('adminEdit=1')).toBe(true);
    expect(isAftercareAdminEditRequested('adminEdit=0')).toBe(false);
    expect(isAftercareAdminEditRequested('')).toBe(false);
  });

  it('allows admin edit mode only for SUPER_ADMIN with token', () => {
    expect(
      canUseAftercareAdminEditMode({
        adminEditRequested: true,
        hasAdminToken: true,
        isSuperAdmin: true,
      }),
    ).toBe(true);
    expect(
      canUseAftercareAdminEditMode({
        adminEditRequested: true,
        hasAdminToken: true,
        isSuperAdmin: false,
      }),
    ).toBe(false);
    expect(
      canUseAftercareAdminEditMode({
        adminEditRequested: false,
        hasAdminToken: true,
        isSuperAdmin: true,
      }),
    ).toBe(false);
  });

  it('shows admin editor only in admin edit mode', () => {
    expect(shouldShowAftercareAdminEditor({ isAdminEditMode: true })).toBe(true);
    expect(shouldShowAftercareAdminEditor({ isAdminEditMode: false })).toBe(false);
  });
});
