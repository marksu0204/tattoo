import type { PublicBrandConfig } from '../config/brands';
import { WHITEHORN_CONFIG } from '../config/brands';

/** Apply customer-facing brand colors via CSS variables (Theme V1). */
export function applyBrandTheme(brand: PublicBrandConfig | null | undefined): void {
  if (typeof document === 'undefined') {
    return;
  }
  const source = brand ?? WHITEHORN_CONFIG;
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', source.primaryColor);
  root.style.setProperty('--brand-accent', source.accentColor);
}