import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { db, hasAdminToken } from '../services/mockBackend';
import { getSavedAdminBrandCode, saveAdminBrandCode, saveAdminIdentity } from '../utils/adminAuth';
import type { AdminContextBrand, AdminContextResponse } from '../types';

type AdminBrandStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AdminBrandContextValue {
  status: AdminBrandStatus;
  error: string | null;
  admin: AdminContextResponse['admin'] | null;
  currentAdminBrand: AdminContextBrand | null;
  accessibleBrands: AdminContextBrand[];
  isSuperAdmin: boolean;
  isBrandAdmin: boolean;
  showBrandSwitcher: boolean;
  brandRevision: number;
  refreshAdminContext: () => Promise<void>;
  switchAdminBrand: (code: string) => Promise<void>;
}

const AdminBrandContext = createContext<AdminBrandContextValue | null>(null);

export const AdminBrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AdminBrandStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminContextResponse['admin'] | null>(null);
  const [currentAdminBrand, setCurrentAdminBrand] = useState<AdminContextBrand | null>(null);
  const [accessibleBrands, setAccessibleBrands] = useState<AdminContextBrand[]>([]);
  const [brandRevision, setBrandRevision] = useState(0);
  const loadRequestIdRef = useRef(0);

  const applyContext = useCallback((data: AdminContextResponse) => {
    setAdmin(data.admin);
    saveAdminIdentity(data.admin);
    setAccessibleBrands(data.accessibleBrands);
    setCurrentAdminBrand(data.currentBrand);
    saveAdminBrandCode(data.currentBrand.code);
    setError(null);
    setStatus('ready');
  }, []);

  const refreshAdminContext = useCallback(async () => {
    if (!hasAdminToken()) {
      setStatus('error');
      setError('Admin 登入尚未就緒');
      return;
    }

    const requestId = ++loadRequestIdRef.current;
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));

    try {
      const data = await db.getAdminContext();
      if (requestId !== loadRequestIdRef.current) return;
      applyContext(data);
    } catch (e) {
      if (requestId !== loadRequestIdRef.current) return;
      setStatus('error');
      setError(e instanceof Error ? e.message : '無法載入 Admin 品牌上下文');
    }
  }, [applyContext]);

  const switchAdminBrand = useCallback(
    async (code: string) => {
      const normalized = code.trim().toLowerCase();
      if (!normalized) return;
      saveAdminBrandCode(normalized);
      setBrandRevision((n) => n + 1);
      await refreshAdminContext();
    },
    [refreshAdminContext]
  );

  useEffect(() => {
    if (!hasAdminToken()) return;
    const saved = getSavedAdminBrandCode();
    if (saved) {
      saveAdminBrandCode(saved);
    }
    void refreshAdminContext();
  }, [refreshAdminContext]);

  const isSuperAdmin = Boolean(admin?.isSuperAdmin);
  const isBrandAdmin = Boolean(admin && !admin.isSuperAdmin);
  const showBrandSwitcher = isSuperAdmin && accessibleBrands.length > 1;

  const value = useMemo<AdminBrandContextValue>(
    () => ({
      status,
      error,
      admin,
      currentAdminBrand,
      accessibleBrands,
      isSuperAdmin,
      isBrandAdmin,
      showBrandSwitcher,
      brandRevision,
      refreshAdminContext,
      switchAdminBrand,
    }),
    [
      status,
      error,
      admin,
      currentAdminBrand,
      accessibleBrands,
      isSuperAdmin,
      isBrandAdmin,
      showBrandSwitcher,
      brandRevision,
      refreshAdminContext,
      switchAdminBrand,
    ]
  );

  return <AdminBrandContext.Provider value={value}>{children}</AdminBrandContext.Provider>;
};

export const useAdminBrand = (): AdminBrandContextValue => {
  const ctx = useContext(AdminBrandContext);
  if (!ctx) {
    throw new Error('useAdminBrand must be used within AdminBrandProvider');
  }
  return ctx;
};
