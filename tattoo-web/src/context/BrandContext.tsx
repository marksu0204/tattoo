import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BrandCode, PublicBrandConfig } from '../config/brands';
import {
  isPublicBrandApiActivationSuccess,
  resolvePublicBrandActivationStatus,
  type PublicBrandActivationStatus,
} from '../utils/brandActivation';
import { applyBrandTheme } from '../utils/brandTheme';
import {
  isPublicBrandPresentation,
  mergePublicBrandPresentation,
} from '../utils/mergeBrandPresentation';
import {
  getDevBrandOverride,
  resolveBrandIdentityFromHostname,
  type BrandIdentityResolution,
} from '../utils/resolveBrand';

export interface BrandContextValue extends BrandIdentityResolution {
  activationStatus: PublicBrandActivationStatus;
  isSupported: boolean;
  isWhitehorn: boolean;
  isGujiguji: boolean;
  brandContextLoading: boolean;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const identity = useMemo(
    () =>
      resolveBrandIdentityFromHostname(window.location.hostname, {
        search: window.location.search,
      }),
    [],
  );

  const [presentationBrand, setPresentationBrand] = useState<PublicBrandConfig | null>(null);
  const [apiValidated, setApiValidated] = useState(false);
  const [brandContextLoading, setBrandContextLoading] = useState(identity.isKnownHost);

  useEffect(() => {
    if (!identity.isKnownHost || !identity.brand) {
      setPresentationBrand(null);
      setApiValidated(false);
      setBrandContextLoading(false);
      return;
    }

    let cancelled = false;
    setPresentationBrand(null);
    setApiValidated(false);
    setBrandContextLoading(true);

    const devHeaders: Record<string, string> = {};
    if (import.meta.env.DEV) {
      const devBrand = getDevBrandOverride();
      if (devBrand) {
        devHeaders['X-Inkflow-Dev-Brand'] = devBrand;
      }
    }

    (async () => {
      try {
        const res = await fetch('/api.php?action=getPublicBrandConfig', {
          headers: devHeaders,
        });

        if (cancelled) return;

        const data: unknown = res.ok ? await res.json() : null;

        if (!isPublicBrandApiActivationSuccess(res.ok, data, identity.brand!.code)) {
          if (!res.ok) {
            console.warn('[BrandContext] getPublicBrandConfig non-OK', res.status);
          } else if (isPublicBrandPresentation(data)) {
            console.warn(
              '[BrandContext] API code mismatch — fail-closed',
              data.code,
              identity.brand!.code,
            );
          } else if (data !== null) {
            console.warn('[BrandContext] invalid public brand config payload');
          }
          setPresentationBrand(null);
          setApiValidated(false);
          return;
        }

        setPresentationBrand({
          ...mergePublicBrandPresentation(identity.brand, data),
          isActive: true,
        });
        setApiValidated(true);
      } catch (err) {
        if (!cancelled) {
          console.warn('[BrandContext] getPublicBrandConfig failed — fail-closed', err);
          setPresentationBrand(null);
          setApiValidated(false);
        }
      } finally {
        if (!cancelled) {
          setBrandContextLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [identity]);

  const activationStatus = resolvePublicBrandActivationStatus({
    isKnownHost: identity.isKnownHost,
    loading: brandContextLoading,
    apiValidated,
  });

  const resolvedBrand = activationStatus === 'active' ? presentationBrand : null;

  useEffect(() => {
    if (activationStatus === 'active') {
      applyBrandTheme(resolvedBrand);
      return;
    }
    if (activationStatus === 'loading' && identity.brand) {
      applyBrandTheme(identity.brand);
      return;
    }
    applyBrandTheme(null);
  }, [resolvedBrand, activationStatus, identity.brand]);

  const value = useMemo<BrandContextValue>(() => {
    const brandCode = resolvedBrand?.code ?? identity.brandCode;

    return {
      ...identity,
      brand: resolvedBrand,
      brandCode,
      activationStatus,
      isSupported: activationStatus === 'active',
      isWhitehorn: brandCode === 'whitehorn',
      isGujiguji: brandCode === 'gujiguji',
      brandContextLoading: activationStatus === 'loading',
    };
  }, [identity, resolvedBrand, activationStatus]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('useBrand must be used within BrandProvider');
  }
  return ctx;
}

/** Optional accessor for Phase 2+ when brand may be absent outside provider. */
export function useBrandOptional(): BrandContextValue | null {
  return useContext(BrandContext);
}

export type { PublicBrandConfig, BrandCode };
