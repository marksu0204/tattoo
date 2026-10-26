
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, hasAdminToken } from '../services/mockBackend';
import { generateArtworkDetails } from '../services/geminiService';
import { Artwork, ArtworkStatus, Appointment } from '../types'; 
import { Plus, Trash2, Edit, Sparkles, X, Settings, Heart, Calendar, CheckCircle, Clock, User, FileText, Save, Phone, Layers, Eye, ArrowUpDown, ArrowUp, ArrowDown, Copy, DollarSign, Users, PenTool, Eraser, BarChart2, Tag, MessageSquare, Search, UserCog, Palette, ShieldCheck } from 'lucide-react';
import LineartTool from '../components/LineartTool';
import RemoveBgTool from '../components/RemoveBgTool';
import BatchPngRegenerator from '../components/BatchPngRegenerator';
import TaxonomyMigrationPanel from '../components/TaxonomyMigrationPanel';
import ArtworkTaxonomyManager from '../components/ArtworkTaxonomyManager';
import ArtworkTagSelector from '../components/ArtworkTagSelector';
import AnalyticsTab from '../components/AnalyticsTab';
import LineMessagingTab, { CustomerTagModal } from '../components/LineMessagingTab';
import AdminAppointmentActions from '../components/AdminAppointmentActions';
import { MemberTag } from '../types';
import { ARTWORK_PLACEMENT_OPTIONS, normalizeArtworkPlacementKeys, type ArtworkPlacementKey } from '../utils/artworkPlacements';
import { compressPngForUpload } from '../utils/compressPngForUpload';
import {
  ARTWORK_PREVIEW_FILTER_LABELS,
  formatRecommendedLength,
  getArtworkPlacementState,
  getArtworkPreviewCompleteness,
  hasArtworkPng,
  hasValidArtworkPlacements,
  hasValidRecommendedLength,
  matchesArtworkPreviewFilter,
  type ArtworkPreviewDataFilter,
} from '../utils/artworkPreviewData';
import {
  AdminAppointmentFilter,
  ADMIN_APPOINTMENT_FILTER_LABELS,
  countPendingActionAppointments,
  filterAppointments,
  getAdminStatusBadgeClass,
  getAdminStatusLabel,
} from '../utils/adminAppointmentStatus';
import { getArtworkClaimAdminLabel, isArtworkClaimedForAdmin } from '../utils/artworkFilters';
import { deriveLegacyCategoryFromTags, emptyTaxonomyCatalog } from '../utils/artworkTaxonomy';
import { buildAppOriginUrl } from '../utils/appUrl';
import {
  REMOVE_BG_PRESET_SETTING_KEY,
  SYSTEM_DEFAULT_REMOVE_BG_PRESET,
  formatRemoveBgPresetSummary,
  generateTransparentPng,
  normalizeRemoveBgPreset,
  type RemoveBgPreset,
  type TransparentPngResult,
} from '../utils/removeBackgroundPreset';
import type { ArtworkTaxonomyCatalogResponse } from '../types';
import { AdminNotReadyError } from '../utils/adminAuth';
import { logAdminFetchError } from '../utils/adminFetch';
import {
  createAsyncLoadState,
  loadError,
  loadSuccess,
  startLoading,
  type AsyncLoadState,
} from '../utils/asyncLoadState';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildAdminSeo } from '../utils/seoConfig';
import { useAdminBrand } from '../context/AdminBrandContext';
import AdminBrandSwitcher from '../components/AdminBrandSwitcher';
import AdminUsersPanel from '../components/AdminUsersPanel';
import AdminBrandSettingsPanel from '../components/AdminBrandSettingsPanel';
import { resolvePublicAssetUrl } from '../utils/publicAssetUrl';

const PreviewDataStatusLine: React.FC<{
  label: string;
  ok: boolean;
  okText: string;
  warnText: string;
}> = ({ label, ok, okText, warnText }) => (
  <div className="flex items-start gap-2 text-xs leading-5">
    <span className="text-gray-500 w-14 shrink-0">{label}</span>
    <span className={ok ? 'text-emerald-400' : 'text-amber-300'}>{ok ? okText : warnText}</span>
  </div>
);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  usePageSeo(buildAdminSeo());
  const {
    status: adminBrandStatus,
    currentAdminBrand,
    isSuperAdmin,
    isBrandAdmin,
    brandRevision,
  } = useAdminBrand();
  const [activeTab, setActiveTab] = useState<'artworks' | 'appointments' | 'customers' | 'lineart' | 'removebg' | 'analytics' | 'line_messaging' | 'brand_settings' | 'admin_users'>('artworks');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({}); // Artwork favorites stats
  
  // --- Sorting State ---
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'views' | 'favorites'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // --- Artwork Form State ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taxonomyCatalog, setTaxonomyCatalog] = useState<ArtworkTaxonomyCatalogResponse>(emptyTaxonomyCatalog());
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [specialPrice, setSpecialPrice] = useState(''); 
  const [heightCm, setHeightCm] = useState('');
  const [sizeNote, setSizeNote] = useState('');
  const [selectedPlacementKeys, setSelectedPlacementKeys] = useState<ArtworkPlacementKey[]>([]);
  const [legacyPlacements, setLegacyPlacements] = useState<string[]>([]);
  const [previewDataFilter, setPreviewDataFilter] = useState<ArtworkPreviewDataFilter>('all');
  const [imageUrl, setImageUrl] = useState(''); 
  const [imageUrls, setImageUrls] = useState<string[]>([]); // 最多3張圖片
  const [pngUrl, setPngUrl] = useState(''); // 去背 PNG 檔案
  const [autoGeneratePng, setAutoGeneratePng] = useState(true);
  const [manualPngUploaded, setManualPngUploaded] = useState(false);
  const [regeneratePngOnSave, setRegeneratePngOnSave] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [originalCoverImageUrl, setOriginalCoverImageUrl] = useState('');
  const [removeBgPreset, setRemoveBgPreset] = useState<RemoveBgPreset>(SYSTEM_DEFAULT_REMOVE_BG_PRESET);
  const [hasCustomRemoveBgPreset, setHasCustomRemoveBgPreset] = useState(false);
  const [isSubmittingArtwork, setIsSubmittingArtwork] = useState(false);
  const [artworkSubmitStatus, setArtworkSubmitStatus] = useState('');
  const [isRegeneratingPng, setIsRegeneratingPng] = useState(false);
  const [autoPngPreviewUrl, setAutoPngPreviewUrl] = useState<string | null>(null);
  const [isPreviewingAutoPng, setIsPreviewingAutoPng] = useState(false);
  const [autoPngColorNote, setAutoPngColorNote] = useState('');
  const [isBatchPngOpen, setIsBatchPngOpen] = useState(false);
  const [isTaxonomyMigrationOpen, setIsTaxonomyMigrationOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isNewArrival, setIsNewArrival] = useState(false);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  
  // --- Deposit Confirmation Modal State ---
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [confirmingApt, setConfirmingApt] = useState<Appointment | null>(null);

  // --- Receive Deposit / Complete Order Modals ---
  const [isReceiveDepositModalOpen, setIsReceiveDepositModalOpen] = useState(false);
  const [receiveDepositApt, setReceiveDepositApt] = useState<Appointment | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completingApt, setCompletingApt] = useState<Appointment | null>(null);

  // --- Appointment List Filter & Menu ---
  const [appointmentFilter, setAppointmentFilter] = useState<AdminAppointmentFilter>('all');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // --- Appointment Edit State ---
  const [isAptModalOpen, setIsAptModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [aptForm, setAptForm] = useState({
      date: '',
      timeSlot: '',
      customerName: '',
      phoneNumber: '',
      artworkTitle: '', 
      notes: '',
      status: 'OPEN' as 'OPEN' | 'PENDING' | 'WAITING_PAYMENT' | 'SIGNING' | 'SIGNED' | 'BOOKED' | 'COMPLETED',
      totalPrice: '',
      depositPaid: '',
      // 同意書欄位
      tattooPosition: '',
      tattooSize: '',
      tattooColor: '',
      consentNotes: ''
  });

  // --- Custom Order Modal State ---
  const [isCustomOrderModalOpen, setIsCustomOrderModalOpen] = useState(false);
  const [customOrderForm, setCustomOrderForm] = useState({
      selectedCustomerId: '',
      totalPrice: '',
      depositAmount: '',
      notes: ''
  });

  // --- Custom Image Upload Modal State ---
  const [isCustomImageModalOpen, setIsCustomImageModalOpen] = useState(false);
  const [uploadingAptId, setUploadingAptId] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState('');

  // --- LINE Member Tags State ---
  const [memberTags, setMemberTags] = useState<MemberTag[]>([]);
  const [tagModalCustomer, setTagModalCustomer] = useState<any | null>(null);
  const [customerTagMap, setCustomerTagMap] = useState<Record<string, MemberTag[]>>({});
  const [favoriteViewerCustomer, setFavoriteViewerCustomer] = useState<any | null>(null);

  // --- Customer Search State ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [isLoadingCustomerTags, setIsLoadingCustomerTags] = useState(false);
  const customerTagsLoadingRef = useRef(false);
  const coreLoadRequestIdRef = useRef(0);
  const memberTagsLoadRequestIdRef = useRef(0);

  const [coreDataLoad, setCoreDataLoad] = useState<AsyncLoadState<null>>(createAsyncLoadState(null));
  const [customersLoad, setCustomersLoad] = useState<AsyncLoadState<null>>(createAsyncLoadState(null));
  const [appointmentsLoad, setAppointmentsLoad] = useState<AsyncLoadState<null>>(createAsyncLoadState(null));
  const [memberTagsLoad, setMemberTagsLoad] = useState<AsyncLoadState<null>>(createAsyncLoadState(null));

  useEffect(() => {
    if (!hasAdminToken()) {
      setCoreDataLoad((prev) => loadError(prev, 'Admin 登入尚未就緒，請重新登入'));
      return;
    }
    if (adminBrandStatus !== 'ready') return;

    setArtworks([]);
    setStats({});
    setAppointments([]);
    setCustomers([]);
    setTaxonomyCatalog(emptyTaxonomyCatalog());
    setCategories([]);
    setSelectedTagIds([]);
    setIsFormOpen(false);
    setEditingId(null);
    coreLoadRequestIdRef.current++;

    loadCoreData();
    loadCategories();
    loadTaxonomyCatalog();
  }, [adminBrandStatus, brandRevision]);

  useEffect(() => {
    if (isBrandAdmin && !['artworks', 'appointments'].includes(activeTab)) {
      setActiveTab('artworks');
    }
  }, [isBrandAdmin, activeTab]);

  useEffect(() => {
    if ((activeTab === 'customers' || activeTab === 'line_messaging') && hasAdminToken()) {
      loadMemberTags();
    }
  }, [activeTab]);

  const loadTaxonomyCatalog = async () => {
    try {
      const data = await db.getArtworkTags({ admin: true });
      setTaxonomyCatalog(data);
    } catch (e) {
      console.error('Failed to load taxonomy tags', e);
    }
  };

  const loadCoreData = async () => {
    if (!hasAdminToken()) {
      setCoreDataLoad((prev) => loadError(prev, 'Admin 登入尚未就緒，請重新登入'));
      return;
    }

    const requestId = ++coreLoadRequestIdRef.current;
    setCoreDataLoad((prev) => startLoading(prev));

    if (isBrandAdmin) {
      setAppointmentsLoad((prev) => startLoading(prev));
      try {
        const [artRes, aptRes] = await Promise.allSettled([
          db.getAdminArtworks(),
          db.getAdminAppointments(),
        ]);
        if (requestId !== coreLoadRequestIdRef.current) return;

        if (artRes.status === 'fulfilled') {
          setArtworks(artRes.value);
          setStats({});
          setCoreDataLoad((prev) => loadSuccess(prev, null));
        } else {
          logAdminFetchError('getAdminArtworks', artRes.reason);
          setCoreDataLoad((prev) => loadError(prev, '作品資料載入失敗'));
        }

        if (aptRes.status === 'fulfilled') {
          const activeApts = aptRes.value
            .filter((a) => a.status !== 'OPEN')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setAppointments(activeApts);
          setAppointmentsLoad((prev) => loadSuccess(prev, null));
        } else {
          setAppointmentsLoad((prev) => loadError(prev, '預約資料載入失敗'));
          logAdminFetchError('getAdminAppointments', aptRes.reason);
        }
      } catch (e) {
        if (requestId !== coreLoadRequestIdRef.current) return;
        logAdminFetchError('loadCoreData', e);
        setCoreDataLoad((prev) => loadError(prev, '資料載入失敗'));
      }
      return;
    }

    setCustomersLoad((prev) => startLoading(prev));
    setAppointmentsLoad((prev) => startLoading(prev));

    const [artRes, statsRes, aptRes, usersRes] = await Promise.allSettled([
      db.getAdminArtworks(),
      db.getArtworkStats(),
      db.getAdminAppointments(),
      db.getAllUsers(),
    ]);

    if (requestId !== coreLoadRequestIdRef.current) return;

    const failedLabels: string[] = [];
    let anySuccess = false;

    if (artRes.status === 'fulfilled') {
      setArtworks(artRes.value);
      anySuccess = true;
    } else {
      failedLabels.push('作品');
      logAdminFetchError('getAdminArtworks', artRes.reason);
    }

    if (statsRes.status === 'fulfilled') {
      setStats(statsRes.value);
      anySuccess = true;
    } else {
      failedLabels.push('作品統計');
      logAdminFetchError('getArtworkStats', statsRes.reason);
    }

    if (aptRes.status === 'fulfilled') {
      const activeApts = aptRes.value
        .filter((a) => a.status !== 'OPEN')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAppointments(activeApts);
      setAppointmentsLoad((prev) => loadSuccess(prev, null));
      anySuccess = true;
    } else {
      failedLabels.push('預約');
      setAppointmentsLoad((prev) => loadError(prev, '預約資料載入失敗'));
      logAdminFetchError('getAdminAppointments', aptRes.reason);
    }

    if (usersRes.status === 'fulfilled') {
      setCustomers(usersRes.value);
      setCustomersLoad((prev) => loadSuccess(prev, null));
      if (activeTab === 'customers') {
        loadCustomerTags(usersRes.value);
      }
      anySuccess = true;
    } else {
      failedLabels.push('顧客');
      setCustomersLoad((prev) => loadError(prev, '顧客資料載入失敗'));
      logAdminFetchError('getAllUsers', usersRes.reason);
    }

    if (anySuccess && failedLabels.length === 0) {
      setCoreDataLoad((prev) => loadSuccess(prev, null));
    } else if (anySuccess) {
      setCoreDataLoad((prev) => ({
        ...prev,
        status: 'error',
        hasLoadedOnce: true,
        error: `部分資料載入失敗：${failedLabels.join('、')}。已保留上一份成功資料。`,
      }));
    } else {
      const authNotReady =
        [artRes, aptRes, usersRes].some(
          (res) => res.status === 'rejected' && res.reason instanceof AdminNotReadyError
        );
      const message = authNotReady
          ? 'Admin 登入尚未就緒，請重新登入'
          : '資料載入失敗，請稍後再試';
      setCoreDataLoad((prev) => loadError(prev, message));
    }
  };

  /** 相容既有呼叫點：重新載入核心 Admin 資料 */
  const loadData = loadCoreData;

  const renderCountLabel = (count: number, loadState: AsyncLoadState<null>) => {
    if (loadState.status === 'loading' && !loadState.hasLoadedOnce) return '…';
    return String(count);
  };

  // 排序作品
  const sortArtworks = (arts: Artwork[], by: typeof sortBy, order: typeof sortOrder) => {
    return [...arts].sort((a, b) => {
      let comparison = 0;
      
      switch (by) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'price':
          const priceA = a.specialPrice || a.price || 0;
          const priceB = b.specialPrice || b.price || 0;
          comparison = priceA - priceB;
          break;
        case 'views':
          comparison = (a.viewCount || 0) - (b.viewCount || 0);
          break;
        case 'favorites':
          comparison = (stats[a.id] || 0) - (stats[b.id] || 0);
          break;
      }
      
      return order === 'asc' ? comparison : -comparison;
    });
  };

  // 取得已排序的作品列表
  const sortedArtworks = sortArtworks(artworks, sortBy, sortOrder);
  const filteredArtworks = sortedArtworks.filter((art) => matchesArtworkPreviewFilter(art, previewDataFilter));
  const filteredAppointments = filterAppointments(appointments, appointmentFilter);
  const pendingActionCount = countPendingActionAppointments(appointments);

  const loadCategories = async () => {
    try {
        const cats = await db.getCategories({ admin: true });
        setCategories(cats);
        if (!category && cats.length > 0) {
            const defaultCat = cats.find(c => c !== 'All') || cats[0];
            setCategory(defaultCat);
        }
    } catch (e) {
        console.error("Error loading categories", e);
    }
  };

  // --- Member Tags Handlers ---

  const loadMemberTags = async () => {
    if (!hasAdminToken()) return;
    const requestId = ++memberTagsLoadRequestIdRef.current;
    setMemberTagsLoad((prev) => startLoading(prev));
    try {
      const tags = await db.getTags();
      if (requestId !== memberTagsLoadRequestIdRef.current) return;
      setMemberTags(tags);
      setMemberTagsLoad((prev) => loadSuccess(prev, null));
    } catch (e) {
      if (requestId !== memberTagsLoadRequestIdRef.current) return;
      setMemberTagsLoad((prev) => loadError(prev, '標籤載入失敗'));
      logAdminFetchError('getTags', e);
    }
  };

  const loadCustomerTags = async (users: any[]) => {
    if (customerTagsLoadingRef.current) return;
    try {
      customerTagsLoadingRef.current = true;
      setIsLoadingCustomerTags(true);
      const map: Record<string, MemberTag[]> = {};
      const tags = await db.getTags();
      const tagById = Object.fromEntries(tags.map(t => [t.id, t]));

      // Avoid burst traffic that can trigger Cloudflare rate/WAF checks.
      const batchSize = 6;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async u => {
            const tagIds = await db.getUserTags(u.id);
            map[u.id] = tagIds.map(id => tagById[id]).filter(Boolean);
          })
        );
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      setCustomerTagMap(map);
    } catch (e) {
      console.error('Failed to load customer tags', e);
    } finally {
      customerTagsLoadingRef.current = false;
      setIsLoadingCustomerTags(false);
    }
  };

  const loadRemoveBgPreset = async () => {
    try {
      const { value } = await db.getAdminSetting<RemoveBgPreset>(REMOVE_BG_PRESET_SETTING_KEY);
      const normalized = normalizeRemoveBgPreset(value);
      if (normalized) {
        setRemoveBgPreset(normalized);
        setHasCustomRemoveBgPreset(true);
        return;
      }
    } catch (e) {
      console.error('Failed to load remove bg preset', e);
    }
    setRemoveBgPreset(SYSTEM_DEFAULT_REMOVE_BG_PRESET);
    setHasCustomRemoveBgPreset(false);
  };

  const clearAutoPngPreview = () => {
    setAutoPngPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const getCoverImageSource = (): File | string | null => {
    if (coverImageFile) return coverImageFile;
    const coverUrl = imageUrls[0] || imageUrl;
    if (!coverUrl) return null;
    if (typeof coverUrl === 'string') {
      return resolvePublicAssetUrl(coverUrl, currentAdminBrand) || coverUrl;
    }
    return coverUrl;
  };

  const describeAutoPngResult = (result: TransparentPngResult) => {
    setAutoPngColorNote(
      result.colorDetected
        ? '偵測到彩色作品，已自動改用「標準去背」保留原色。'
        : ''
    );
  };

  const generateAndUploadPngFromCover = async (): Promise<string> => {
    const source = getCoverImageSource();
    if (!source) throw new Error('缺少主圖');
    const result = await generateTransparentPng(source, removeBgPreset);
    describeAutoPngResult(result);
    const pngFile = new File([result.blob], 'generated-preview.png', { type: 'image/png' });
    const compressed = await compressPngForUpload(pngFile);
    return db.uploadPngFile(compressed.blob);
  };

  const handleEditArtwork = (art: Artwork) => {
    setAutoPngColorNote('');
    setEditingId(art.id);
    setTitle(art.title);
    setCategory(art.category);
    setPrice(art.price ? art.price.toString() : '');
    setSpecialPrice(art.specialPrice ? art.specialPrice.toString() : '');
    setHeightCm(typeof art.heightCm === 'number' ? art.heightCm.toString() : '');
    setSizeNote(art.sizeNote || '');
    const placementState = getArtworkPlacementState(art);
    setSelectedPlacementKeys(normalizeArtworkPlacementKeys(placementState.keys));
    setLegacyPlacements(placementState.legacy);
    setImageUrl(art.imageUrl);
    const existingUrls = art.imageUrls && art.imageUrls.length > 0 ? art.imageUrls : [art.imageUrl];
    setImageUrls(existingUrls.filter(Boolean));
    setPngUrl(art.pngUrl || '');
    setDescription(art.description);
    setTags(art.tags);
    setIsNewArrival(Boolean(art.isNew));
    setSelectedTagIds(Array.isArray(art.tagIds) ? art.tagIds : (art.taxonomyTags?.map((tag) => tag.id) ?? []));
    setAutoGeneratePng(true);
    setManualPngUploaded(false);
    setRegeneratePngOnSave(false);
    setCoverImageFile(null);
    setOriginalCoverImageUrl(art.imageUrl);
    clearAutoPngPreview();
    if (isSuperAdmin) void loadRemoveBgPreset();
    setIsFormOpen(true);
  };

  const togglePlacementKey = (key: ArtworkPlacementKey) => {
    setSelectedPlacementKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  // 圖片壓縮函數 - 解決 iPad/手機大圖片上傳問題
  const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 如果圖片寬度超過最大寬度，等比例縮小
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context error'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // 轉換為壓縮後的 Base64
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Image load error'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  };

  // PNG 壓縮函數 - 保留透明度（一般作品圖仍使用）
  const compressPng = (file: File, maxWidth: number = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 如果圖片寬度超過最大寬度，等比例縮小
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context error'));
            return;
          }
          
          // 清除背景，保持透明
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // PNG 格式保留透明度
          const compressedDataUrl = canvas.toDataURL('image/png');
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Image load error'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  };

  // 🔒 允許的圖片類型
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const ALLOWED_PNG_TYPES = ['image/png'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // 🔒 驗證檔案是否為有效圖片
  const validateImageFile = (file: File, allowedTypes: string[]): { valid: boolean; error?: string } => {
    // 檢查檔案類型
    if (!allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: `不支援的檔案格式。僅允許：${allowedTypes.map(t => t.replace('image/', '')).join(', ')}` 
      };
    }
    
    // 檢查檔案大小
    if (file.size > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `檔案太大。最大允許 ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      };
    }
    
    // 檢查檔案副檔名
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      return { 
        valid: false, 
        error: '檔案副檔名不正確。請上傳圖片檔案。' 
      };
    }
    
    return { valid: true };
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      const validation = validateImageFile(file, ALLOWED_IMAGE_TYPES);
      if (!validation.valid) {
        alert(`⚠️ 上傳失敗：${validation.error}`);
        e.target.value = '';
        return;
      }

      if (imageUrls.length >= 3) {
        alert('⚠️ 最多只能上傳 3 張圖片');
        e.target.value = '';
        return;
      }
      
      try {
        const compressed = await compressImage(file, 1200, 0.8);
        const url = await db.uploadImage(compressed, false);
        const isNewCover = imageUrls.length === 0;
        const newUrls = [...imageUrls, url];
        setImageUrls(newUrls);
        if (newUrls.length === 1) setImageUrl(url);

        if (isNewCover) {
          setCoverImageFile(file);
          clearAutoPngPreview();
          if (editingId && originalCoverImageUrl && url !== originalCoverImageUrl) {
            if (autoGeneratePng && !manualPngUploaded) {
              const ok = window.confirm('主圖已變更，是否重新產生透明 PNG？');
              setRegeneratePngOnSave(ok);
            }
          }
        }
      } catch (error) {
        console.error('Image upload failed:', error);
        alert('⚠️ 圖片上傳失敗，請確認網路連線後再試。');
        e.target.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(newUrls);
    setImageUrl(newUrls[0] || '');
    if (index === 0) {
      setCoverImageFile(null);
      clearAutoPngPreview();
      setRegeneratePngOnSave(false);
    }
  };

  const handlePngChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // 🔒 驗證檔案（僅限 PNG）
      const validation = validateImageFile(file, ALLOWED_PNG_TYPES);
      if (!validation.valid) {
        alert(`⚠️ 上傳失敗：${validation.error}\n\n刺青預覽圖案僅支援 PNG 格式（需要透明背景）。`);
        e.target.value = '';
        return;
      }
      
      try {
        const compressed = await compressPngForUpload(file);
        const url = await db.uploadPngFile(compressed.blob);
        setPngUrl(url);
        setManualPngUploaded(true);
        setRegeneratePngOnSave(false);
        clearAutoPngPreview();
      } catch (error) {
        console.error('PNG upload failed:', error);
        const message = error instanceof Error ? error.message : '';
        if (message === 'REQUEST_ENTITY_TOO_LARGE') {
          alert('⚠️ PNG 上傳失敗：檔案超過伺服器允許的請求大小（413）。\n\n系統已自動壓縮；若仍失敗，請先縮小原圖尺寸或簡化 PNG 後再試。');
        } else if (message.includes('超過伺服器允許大小')) {
          alert(`⚠️ ${message}`);
        } else {
          alert('⚠️ PNG 上傳失敗，請確認網路連線後再試。');
        }
        e.target.value = '';
      }
    }
  };

  const handleAiGenerate = async () => {
    if (!title && !category) return;
    setAiLoading(true);
    try {
        const result = await generateArtworkDetails(`${category} tattoo style, ${title}`);
        setDescription(result.description);
        setTags(result.tags);
    } catch (e) {
        alert("AI 生成失敗，請重試。");
    } finally {
        setAiLoading(false);
    }
  };

  const getMysqlDateTime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };

  const handlePreviewAutoPng = async () => {
    const source = getCoverImageSource();
    if (!source) {
      alert('請先上傳主圖');
      return;
    }
    setIsPreviewingAutoPng(true);
    try {
      const result = await generateTransparentPng(source, removeBgPreset);
      describeAutoPngResult(result);
      clearAutoPngPreview();
      setAutoPngPreviewUrl(URL.createObjectURL(result.blob));
    } catch (error) {
      console.error(error);
      alert('預覽產生失敗，請稍後再試。');
    } finally {
      setIsPreviewingAutoPng(false);
    }
  };

  const handleRegeneratePng = async () => {
    if (!window.confirm('確定要使用目前預設重新產生透明 PNG？這會覆蓋現有 PNG。')) return;
    setIsRegeneratingPng(true);
    setArtworkSubmitStatus('正在產生透明 PNG...');
    try {
      const url = await generateAndUploadPngFromCover();
      setPngUrl(url);
      setManualPngUploaded(false);
      setRegeneratePngOnSave(false);
      clearAutoPngPreview();
    } catch (error) {
      console.error(error);
      alert('透明 PNG 產生失敗，請稍後再試。');
    } finally {
      setIsRegeneratingPng(false);
      setArtworkSubmitStatus('');
    }
  };

  const handleSubmitArtwork = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveImageUrl = imageUrls[0] || imageUrl;
    if (!title || !effectiveImageUrl || isSubmittingArtwork) return;
    const parsedHeightCm = heightCm.trim() ? Number(heightCm) : undefined;
    if (parsedHeightCm !== undefined && (!Number.isFinite(parsedHeightCm) || parsedHeightCm <= 0)) {
      alert('建議長度必須大於 0');
      return;
    }
    const existingArtwork = editingId ? artworks.find(a => a.id === editingId) : undefined;
    const parsedWidthCm = existingArtwork?.widthCm;

    const legacyCategory = deriveLegacyCategoryFromTags(
      selectedTagIds,
      taxonomyCatalog,
      existingArtwork?.category || category || '未分類'
    );

    const shouldAutoGeneratePng =
      autoGeneratePng &&
      !manualPngUploaded &&
      Boolean(getCoverImageSource()) &&
      (!editingId || regeneratePngOnSave);

    let finalPngUrl = pngUrl;
    let pngGenerationFailed = false;

    setIsSubmittingArtwork(true);
    setArtworkSubmitStatus('正在處理圖片...');

    try {
      if (shouldAutoGeneratePng) {
        setArtworkSubmitStatus('正在產生透明 PNG...');
        try {
          finalPngUrl = await generateAndUploadPngFromCover();
        } catch (pngError) {
          pngGenerationFailed = true;
          console.error('Auto PNG generation failed:', pngError);
          finalPngUrl = pngUrl;
        }
      }

      setArtworkSubmitStatus('正在儲存作品...');

      const newArtwork: Artwork = {
        id: editingId || Date.now().toString(),
        title,
        description: description || 'No description provided.',
        imageUrl: effectiveImageUrl,
        imageUrls: imageUrls.length > 0 ? imageUrls : [effectiveImageUrl],
        pngUrl: finalPngUrl || undefined,
        category: legacyCategory,
        price: price ? Number(price) : undefined,
        specialPrice: specialPrice ? Number(specialPrice) : undefined,
        widthCm: parsedWidthCm,
        heightCm: parsedHeightCm,
        sizeNote: sizeNote.trim() || undefined,
        recommendedPlacements: selectedPlacementKeys,
        recommendedPlacementKeys: selectedPlacementKeys,
        status: editingId ? artworks.find(a => a.id === editingId)?.status || ArtworkStatus.AVAILABLE : ArtworkStatus.AVAILABLE,
        createdAt: editingId ? (artworks.find(a => a.id === editingId)?.createdAt || getMysqlDateTime()) : getMysqlDateTime(),
        tags: tags,
        tagIds: selectedTagIds,
        isNew: isNewArrival,
      };

      await db.saveArtwork(newArtwork);
      setIsFormOpen(false);
      setEditingId(null);
      resetArtworkForm();
      loadData();

      if (pngGenerationFailed) {
        alert('作品已建立，但透明 PNG 產生失敗，可稍後重新產生。');
      }
    } catch (error: any) {
        console.error(error);
        alert(`無法儲存作品。\n\n錯誤: ${error.message}`);
    } finally {
      setIsSubmittingArtwork(false);
      setArtworkSubmitStatus('');
    }
  };

  const handleDeleteArtwork = async (id: string) => {
    if (window.confirm('確定要刪除此作品嗎？')) {
      try {
        await db.deleteArtwork(id);
        loadData();
      } catch (error: any) {
        alert(`刪除失敗: ${error.message}`);
      }
    }
  };

  const toggleStatus = async (id: string) => {
    try {
        await db.toggleStatus(id);
        loadData();
    } catch (error: any) {
        alert(`狀態更新失敗: ${error.message}`);
    }
  };

  const handleAddCategory = async () => {
    if (newCategoryInput.trim()) {
      try {
        const updated = await db.addCategory(newCategoryInput.trim());
        setCategories(updated);
        setNewCategoryInput('');
      } catch (error: any) {
        alert(`新增分類失敗: ${error.message}`);
      }
    }
  };

  const handleDeleteCategory = async (cat: string) => {
    if (window.confirm(`確定要刪除分類 "${cat}" 嗎？`)) {
        try {
            const updated = await db.deleteCategory(cat);
            setCategories(updated);
        } catch (error: any) {
            alert(`刪除失敗: ${error.message}`);
        }
    }
  };

  const resetArtworkForm = () => {
    setAutoPngColorNote('');
    setTitle('');
    setDescription('');
    setPrice('');
    setSpecialPrice('');
    setHeightCm('');
    setSizeNote('');
    setSelectedPlacementKeys([]);
    setLegacyPlacements([]);
    setTags([]);
    setImageUrl('');
    setImageUrls([]);
    setPngUrl('');
    setAutoGeneratePng(true);
    setManualPngUploaded(false);
    setRegeneratePngOnSave(false);
    setCoverImageFile(null);
    setOriginalCoverImageUrl('');
    clearAutoPngPreview();
    setArtworkSubmitStatus('');
    setIsSubmittingArtwork(false);
    setIsRegeneratingPng(false);
    setSelectedTagIds([]);
    setIsNewArrival(false);
    setEditingId(null);
    if (categories.length > 0) {
        const defaultCat = categories.find(c => c !== 'All') || categories[0];
        setCategory(defaultCat);
    }
  };

  // --- Appointment Handlers ---

  // 打開確認訂金彈窗
  const openDepositModal = (apt: Appointment) => {
      setConfirmingApt(apt);
      setDepositAmount(apt.depositPaid ? apt.depositPaid.toString() : '');
      setIsDepositModalOpen(true);
  };

  // 設定訂金（填寫訂金金額後 → WAITING_PAYMENT）
  const confirmDeposit = async () => {
      if (!confirmingApt || !depositAmount) {
          alert('請輸入訂金金額');
          return;
      }
      
      try {
          const depositValue = parseInt(depositAmount);
          if (isNaN(depositValue) || depositValue <= 0) {
              alert('請輸入有效的訂金金額');
              return;
          }
          
          const updatedApt: Appointment = {
              ...confirmingApt,
              status: 'WAITING_PAYMENT',
              depositPaid: depositValue
          };
          await db.saveAppointment(updatedApt);
          setIsDepositModalOpen(false);
          setConfirmingApt(null);
          setDepositAmount('');
          loadData();
      } catch (error: any) {
          alert(`確認失敗: ${error.message}`);
      }
  };

  // 複製訂金訊息
  const copyDepositMessage = (apt: Appointment) => {
      const depositAmount = apt.depositPaid || 0;
      const message = `您好，本次刺青會跟您收${depositAmount}元訂金

___《刺青定金規範》___

國泰世華013
帳號074500096113

定金匯款視同合約成立，不作退費

🏷️認領圖限定3個月內完成刺青
🏷️客製圖畫好後一樣是3個月的期限
🌟期限內未完成刺青，定金不退`;
      
      navigator.clipboard.writeText(message);
      alert('訂金訊息已複製！');
  };

  const openReceiveDepositModal = (apt: Appointment) => {
      setReceiveDepositApt(apt);
      setIsReceiveDepositModalOpen(true);
  };

  const confirmReceivedDeposit = async () => {
      if (!receiveDepositApt) return;
      try {
          const updatedApt: Appointment = {
              ...receiveDepositApt,
              status: 'SIGNING',
          };
          await db.saveAppointment(updatedApt);
          setAppointments((prev) =>
            prev.map((a) => (a.id === updatedApt.id ? { ...a, status: 'SIGNING' } : a))
          );
          setIsReceiveDepositModalOpen(false);
          setReceiveDepositApt(null);
          loadData();
      } catch (error: any) {
          alert(`確認失敗: ${error.message}`);
      }
  };

  const openCompleteModal = (apt: Appointment) => {
      setCompletingApt(apt);
      setIsCompleteModalOpen(true);
  };

  const confirmCompleteOrder = async () => {
      if (!completingApt) return;
      try {
          await db.completeAppointment(completingApt.id);
          setAppointments((prev) =>
            prev.map((a) => (a.id === completingApt.id ? { ...a, status: 'COMPLETED' } : a))
          );
          setIsCompleteModalOpen(false);
          setCompletingApt(null);
          loadData();
      } catch (error: any) {
          alert(`完成訂單失敗: ${error.message}`);
      }
  };

  // 複製同意書訊息
  const copyConsentMessage = async (apt: Appointment) => {
      const links = await db.getAdminAppointmentPublicLinks(apt.id);
      if (!links?.consentUrl) {
        alert('無法取得顧客同意書連結，請稍後再試。');
        return;
      }
      const message = `您好，已經收到您的訂金，下列為此次刺青的同意書，

請您確認內容沒問題並且線上簽名並送出即可，感謝!

${links.consentUrl}`;
      
      navigator.clipboard.writeText(message);
      alert('同意書訊息已複製！');
  };

  // 檢查簽署狀態並自動更新
  useEffect(() => {
      let hasUpdate = false;
      const checkSigningStatus = async () => {
          for (const apt of appointments) {
              // 如果狀態是 SIGNING 且已經簽署完成，自動更新為 SIGNED
              if (apt.status === 'SIGNING' && apt.signedAt && !hasUpdate) {
                  try {
                      const updatedApt: Appointment = {
                          ...apt,
                          status: 'SIGNED'
                      };
                      await db.saveAppointment(updatedApt);
                      hasUpdate = true;
                      // 只更新一次，避免重複更新
                      break;
                  } catch (err) {
                      console.error('更新簽署狀態失敗', err);
                  }
              }
          }
          if (hasUpdate) {
              // 如果有更新，重新載入資料
              loadData();
          }
      };
      
      if (appointments.length > 0) {
          checkSigningStatus();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments.length]);

  const cancelAppointment = async (id: string) => {
      if (window.confirm('確定要取消此預約並釋出時段嗎？')) {
          try {
            await db.cancelAppointment(id);
            setAppointments((prev) => prev.filter((a) => a.id !== id));
          } catch (error: any) {
            alert(`取消失敗: ${error.message}`);
          }
      }
  };

  // --- Custom Order Handler ---
  const handleCreateCustomOrder = async () => {
      if (!customOrderForm.selectedCustomerId) {
          alert('請選擇顧客');
          return;
      }
      if (!customOrderForm.totalPrice || !customOrderForm.depositAmount) {
          alert('請填寫總金額和訂金金額');
          return;
      }

      try {
          const selectedCustomer = customers.find(c => c.id === customOrderForm.selectedCustomerId);

          if (!selectedCustomer) {
              alert('找不到選中的顧客');
              return;
          }

          // 生成唯一的預約ID
          const appointmentId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          const totalPrice = parseInt(customOrderForm.totalPrice);
          const depositAmount = parseInt(customOrderForm.depositAmount);

          if (isNaN(totalPrice) || isNaN(depositAmount)) {
              alert('請輸入有效的金額');
              return;
          }

          // 創建客製圖預約 - 初始狀態為 WAITING_PAYMENT（待付款）
          const newAppointment: Appointment = {
              id: appointmentId,
              date: new Date().toISOString().split('T')[0],
              timeSlot: '待定',
              userId: selectedCustomer.id,
              customerName: selectedCustomer.name,
              phoneNumber: (selectedCustomer as any).phoneNumber || '',
              status: 'WAITING_PAYMENT', // 客製圖直接進入待付款狀態
              orderType: 'CUSTOM',
              notes: customOrderForm.notes || '客製圖訂單',
              artworkId: undefined, // 客製圖開單時沒有作品
              artworkTitle: '客製圖（製作中）',
              artworkImage: undefined, // 稍後上傳
              totalPrice: totalPrice,
              depositPaid: depositAmount
          };

          await db.saveAppointment(newAppointment);
          
          // 重置表單並關閉彈窗
          setCustomOrderForm({
              selectedCustomerId: '',
              totalPrice: '',
              depositAmount: '',
              notes: ''
          });
          setIsCustomOrderModalOpen(false);
          
          loadData();
          
          alert('客製圖訂單創建成功！請複製訂金訊息傳送給客人。');
      } catch (error: any) {
          alert(`創建失敗: ${error.message}`);
      }
  };

  // --- 上傳客製圖片 ---
  const openCustomImageUpload = (apt: Appointment) => {
      setUploadingAptId(apt.id);
      setCustomImageUrl(apt.artworkImage || '');
      setIsCustomImageModalOpen(true);
  };

  const handleCustomImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setCustomImageUrl(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const saveCustomImage = async () => {
      if (!uploadingAptId || !customImageUrl) {
          alert('請上傳圖片');
          return;
      }

      try {
          const apt = appointments.find(a => a.id === uploadingAptId);
          if (!apt) {
              alert('找不到訂單');
              return;
          }

          const updatedApt: Appointment = {
              ...apt,
              artworkImage: customImageUrl,
              artworkTitle: '客製圖（已完成）'
          };

          await db.saveAppointment(updatedApt);
          setIsCustomImageModalOpen(false);
          setUploadingAptId(null);
          setCustomImageUrl('');
          loadData();
          alert('客製圖片上傳成功！現在可以傳送同意書給客人。');
      } catch (error: any) {
          alert(`上傳失敗: ${error.message}`);
      }
  };

  const handleEditAppointment = (apt: Appointment) => {
      setEditingApt(apt);
      
      // 如果預約有關聯商品，且總價為空，自動帶入商品價格
      let autoTotalPrice = apt.totalPrice ? apt.totalPrice.toString() : '';
      
      // 調試資訊
      console.log('[編輯預約]', {
          appointmentId: apt.id,
          artworkId: apt.artworkId,
          artworkTitle: apt.artworkTitle,
          currentTotalPrice: apt.totalPrice,
          artworksCount: artworks.length,
          status: apt.status
      });
      
      // 只有在總價為空時才自動帶入
      if (!autoTotalPrice && apt.artworkId) {
          if (artworks.length === 0) {
              console.warn('[警告] 商品列表尚未載入，無法自動帶入價格');
          } else {
              const artwork = artworks.find(a => a.id === apt.artworkId);
              if (artwork) {
                  // 優先使用特價，否則使用原價
                  const price = artwork.specialPrice || artwork.price;
                  if (price) {
                      autoTotalPrice = price.toString();
                      console.log(`[✓ 自動帶入價格] 商品: ${artwork.title}, 價格: ${price} (特價: ${artwork.specialPrice || '無'}, 原價: ${artwork.price || '無'})`);
                  } else {
                      console.warn(`[警告] 商品 ${artwork.title} 沒有設定價格`);
                  }
              } else {
                  console.warn(`[找不到商品] artworkId: ${apt.artworkId}, 商品列表中的ID:`, artworks.map(a => a.id).slice(0, 5));
              }
          }
      } else if (autoTotalPrice) {
          console.log(`[總價已有值] ${autoTotalPrice}，不自動帶入`);
      } else if (!apt.artworkId) {
          console.log('[無關聯商品] 此預約沒有關聯商品');
      }
      
      setAptForm({
          date: apt.date,
          timeSlot: apt.timeSlot,
          customerName: apt.customerName || '',
          phoneNumber: apt.phoneNumber || '',
          artworkTitle: apt.artworkTitle || '',
          notes: apt.notes || '',
          status: apt.status,
          totalPrice: autoTotalPrice,
          depositPaid: apt.depositPaid ? apt.depositPaid.toString() : '',
          tattooPosition: apt.tattooPosition || '',
          tattooSize: apt.tattooSize || '',
          tattooColor: apt.tattooColor || '',
          consentNotes: apt.consentNotes || ''
      });
      setIsAptModalOpen(true);
  };

  // 複製同意書連結
  const copyConsentLink = async (aptId: string) => {
      const links = await db.getAdminAppointmentPublicLinks(aptId);
      if (!links?.consentUrl) {
        alert('無法取得顧客同意書連結，請稍後再試。');
        return;
      }
      navigator.clipboard.writeText(links.consentUrl);
      alert('同意書連結已複製！');
  };

  const copyAppointmentLink = async (aptId: string) => {
      const links = await db.getAdminAppointmentPublicLinks(aptId);
      if (!links?.appointmentUrl) {
        alert('無法取得顧客訂單連結，請稍後再試。');
        return;
      }
      navigator.clipboard.writeText(links.appointmentUrl);
      alert('訂單查看連結已複製！');
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingApt) return;

      const updatedApt: Appointment = {
          ...editingApt,
          date: aptForm.date,
          timeSlot: aptForm.timeSlot,
          customerName: aptForm.customerName,
          phoneNumber: aptForm.phoneNumber,
          artworkTitle: aptForm.artworkTitle,
          notes: aptForm.notes,
          status: aptForm.status,
          totalPrice: aptForm.totalPrice ? parseInt(aptForm.totalPrice) : undefined,
          depositPaid: aptForm.depositPaid ? parseInt(aptForm.depositPaid) : undefined,
          tattooPosition: aptForm.tattooPosition || undefined,
          tattooSize: aptForm.tattooSize || undefined,
          tattooColor: aptForm.tattooColor || undefined,
          consentNotes: aptForm.consentNotes || undefined
      };

      try {
        await db.saveAppointment(updatedApt);
        setIsAptModalOpen(false);
        setEditingApt(null);
        loadData();
      } catch (error: any) {
        alert(`儲存失敗: ${error.message}`);
      }
  };

  const parseFavoriteSearch = (keyword: string): { operator: '>' | '>=' | '<' | '<=' | '='; value: number } | null => {
    const trimmed = keyword.trim();
    if (!trimmed) return null;

    const normalized = trimmed
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/^收藏數量|^收藏數|^收藏|^favoritecount|^favorites|^favorite/, '');

    const matched = normalized.match(/^(>=|<=|>|<|=)(\d+)$/);
    if (!matched) return null;

    return {
      operator: matched[1] as '>' | '>=' | '<' | '<=' | '=',
      value: Number(matched[2]),
    };
  };

  const matchFavoriteCondition = (favoriteCount: number, operator: '>' | '>=' | '<' | '<=' | '=', value: number): boolean => {
    switch (operator) {
      case '>':
        return favoriteCount > value;
      case '>=':
        return favoriteCount >= value;
      case '<':
        return favoriteCount < value;
      case '<=':
        return favoriteCount <= value;
      case '=':
        return favoriteCount === value;
      default:
        return false;
    }
  };

  const filteredCustomers = (() => {
    const q = customerSearch.trim();
    if (!q) return customers;

    const favoriteQuery = parseFavoriteSearch(q);
    if (favoriteQuery) {
      return customers.filter(c =>
        matchFavoriteCondition(Number(c.favoriteCount || 0), favoriteQuery.operator, favoriteQuery.value)
      );
    }

    const lowerQ = q.toLowerCase();
    return customers.filter(c =>
      c.name?.toLowerCase().includes(lowerQ) ||
      c.id?.toLowerCase().includes(lowerQ) ||
      (customerTagMap[c.id] || []).some((t: MemberTag) => t.name.toLowerCase().includes(lowerQ))
    );
  })();

  const getCustomerFavoriteIds = (customer: any): string[] => {
    if (Array.isArray(customer?.favorites)) return customer.favorites;

    if (typeof customer?.favorites === 'string') {
      try {
        const parsed = JSON.parse(customer.favorites);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  };

  const favoriteViewerIds = favoriteViewerCustomer ? getCustomerFavoriteIds(favoriteViewerCustomer) : [];
  const favoriteViewerArtworks = favoriteViewerIds
    .map((artId: string) => artworks.find((art) => art.id === artId))
    .filter(Boolean) as Artwork[];
  const missingFavoriteCount = Math.max(0, favoriteViewerIds.length - favoriteViewerArtworks.length);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">管理後台</h1>
          {currentAdminBrand && (
            <p className="text-sm text-gray-400 mt-1">
              {isBrandAdmin ? '品牌' : '目前操作'}：<span className="text-primary">{currentAdminBrand.name}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <AdminBrandSwitcher />
          {isSuperAdmin && (
            <Link
              to="/aftercare?adminEdit=1"
              className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg font-bold flex items-center hover:bg-gray-700 hover:text-white transition-colors whitespace-nowrap"
            >
              <ShieldCheck size={18} className="mr-2" /> 編輯保養須知
            </Link>
          )}
          {activeTab === 'artworks' && (
            <div className="flex gap-2">
                <button 
                onClick={() => setIsCatManagerOpen(true)}
                className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg font-bold flex items-center hover:bg-gray-700 transition-colors"
                >
                <Settings size={20} className="mr-2" /> 管理分類
                </button>
                {isSuperAdmin && (
                  <button
                  onClick={() => { void loadRemoveBgPreset(); setIsBatchPngOpen(true); }}
                  className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg font-bold flex items-center hover:bg-gray-700 transition-colors whitespace-nowrap"
                  >
                  <Layers size={20} className="mr-2" /> 批次重新產生 PNG
                  </button>
                )}
                {isSuperAdmin && (
                  <button
                  onClick={() => setIsTaxonomyMigrationOpen(true)}
                  className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg font-bold flex items-center hover:bg-gray-700 transition-colors whitespace-nowrap"
                  >
                  <Tag size={20} className="mr-2" /> 分類整理
                  </button>
                )}
                <button 
                onClick={() => { resetArtworkForm(); if (isSuperAdmin) void loadRemoveBgPreset(); setIsFormOpen(true); }}
                className="bg-primary text-black px-4 py-2 rounded-lg font-bold flex items-center hover:bg-yellow-500 transition-colors"
                >
                <Plus size={20} className="mr-2" /> 新增作品
                </button>
            </div>
          )}
        </div>
      </div>

      {coreDataLoad.error && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-amber-200">{coreDataLoad.error}</p>
          <button
            type="button"
            onClick={() => loadCoreData()}
            className="shrink-0 text-sm px-3 py-1.5 rounded-lg border border-amber-400/40 text-amber-100 hover:bg-amber-500/10"
          >
            重新載入
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('artworks')}
          className={`pb-2 px-4 whitespace-nowrap ${activeTab === 'artworks' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          作品管理
        </button>
        {(isSuperAdmin || isBrandAdmin) && (
        <button 
           onClick={() => setActiveTab('appointments')}
           className={`pb-2 px-4 whitespace-nowrap ${activeTab === 'appointments' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          預約管理 ({renderCountLabel(pendingActionCount, appointmentsLoad)} 待處理)
        </button>
        )}
        {isSuperAdmin && (
        <>
        <button 
           onClick={() => setActiveTab('customers')}
           className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap ${activeTab === 'customers' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          <Users size={16} />
          顧客名單 ({renderCountLabel(customers.length, customersLoad)})
        </button>
        <div className="border-l border-gray-700 mx-1"></div>
        <button 
           onClick={() => setActiveTab('lineart')}
           className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap ${activeTab === 'lineart' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          <PenTool size={16} />
          線稿提取
        </button>
        <button 
           onClick={() => setActiveTab('removebg')}
           className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap ${activeTab === 'removebg' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          <Eraser size={16} />
          自動去背
        </button>
        <button 
           onClick={() => setActiveTab('analytics')}
           className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap ${activeTab === 'analytics' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          <BarChart2 size={16} />
          數據分析
        </button>
        <button 
           onClick={() => setActiveTab('line_messaging')}
           className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap ${activeTab === 'line_messaging' ? 'text-[#00B900] border-b-2 border-[#00B900]' : 'text-gray-400'}`}
        >
          <MessageSquare size={16} />
          LINE 推播
        </button>
        <button
           onClick={() => setActiveTab('brand_settings')}
           className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap ${activeTab === 'brand_settings' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          <Palette size={16} />
          品牌設定
        </button>
        <button
           onClick={() => setActiveTab('admin_users')}
           className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap ${activeTab === 'admin_users' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          <UserCog size={16} />
          管理員帳號
        </button>
        </>
        )}
      </div>

      {/* --- Artwork List --- */}
      {activeTab === 'artworks' && (
        <div>
          {coreDataLoad.status === 'loading' && !coreDataLoad.hasLoadedOnce ? (
            <div className="text-center py-20 text-gray-400">作品載入中…</div>
          ) : coreDataLoad.status === 'error' && !coreDataLoad.hasLoadedOnce && artworks.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-amber-300 mb-4">{coreDataLoad.error || '作品資料載入失敗'}</p>
              <button type="button" onClick={() => loadCoreData()} className="px-4 py-2 rounded-lg bg-primary text-black font-bold">重新載入</button>
            </div>
          ) : (
        <>
          {/* 排序控制項 */}
          <div className="flex items-center gap-4 mb-4 bg-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-gray-400">
              <ArrowUpDown size={16} />
              <span className="text-sm font-medium">排序：</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
            >
              <option value="date">建立日期</option>
              <option value="price">價格</option>
              <option value="views">瀏覽次數</option>
              <option value="favorites">收藏數</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-colors ${
                sortOrder === 'desc' 
                  ? 'bg-primary/10 border-primary text-primary' 
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              {sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
              <span className="text-sm">{sortOrder === 'desc' ? '高到低' : '低到高'}</span>
            </button>
            <span className="text-xs text-gray-500 ml-auto">
              共 {filteredArtworks.length} / {artworks.length} 件作品
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(ARTWORK_PREVIEW_FILTER_LABELS) as ArtworkPreviewDataFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreviewDataFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  previewDataFilter === key
                    ? 'bg-primary text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                }`}
              >
                {ARTWORK_PREVIEW_FILTER_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-dark text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-6 py-4">縮圖</th>
                  <th className="px-6 py-4">資訊</th>
                  <th className="px-6 py-4">預覽資料</th>
                  <th className="px-6 py-4">價格</th>
                  <th className="px-6 py-4">瀏覽</th>
                  <th className="px-6 py-4">狀態</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredArtworks.map(art => {
                  const placementState = getArtworkPlacementState(art);
                  const completeness = getArtworkPreviewCompleteness(art);
                  const lengthLabel = formatRecommendedLength(art.heightCm);
                  return (
                <tr key={art.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <img src={art.imageUrl} alt="" className="w-12 h-12 rounded object-cover" />
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/artwork/${art.id}`)}
                      className="text-left hover:text-primary transition-colors cursor-pointer"
                    >
                      <p className="font-bold text-white hover:text-primary">{art.title}</p>
                      <p className="text-xs text-gray-500 mb-1">{art.category}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-pink-400 text-xs font-medium">
                            <Heart size={12} className="fill-current"/> 
                            {stats[art.id] || 0} 收藏
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1 min-w-[180px]">
                      <PreviewDataStatusLine
                        label="PNG"
                        ok={hasArtworkPng(art)}
                        okText="✓ 已有"
                        warnText="⚠ 缺少"
                      />
                      <PreviewDataStatusLine
                        label="建議長度"
                        ok={hasValidRecommendedLength(art)}
                        okText={lengthLabel ?? '✓ 已有'}
                        warnText="⚠ 未填"
                      />
                      <PreviewDataStatusLine
                        label="施作部位"
                        ok={hasValidArtworkPlacements(art)}
                        okText={placementState.labels || '✓ 已設定'}
                        warnText="⚠ 未設定"
                      />
                      <p className="text-[11px] text-gray-500 pt-1">{completeness.complete} / {completeness.total} 完整</p>
                      {art.isNew && (
                        <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                          新上架
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     {art.specialPrice ? (
                         <div className="flex flex-col">
                             <span className="text-red-400 font-bold">${art.specialPrice}</span>
                             <span className="text-gray-600 text-xs line-through">${art.price}</span>
                         </div>
                     ) : (
                        <span className="text-gray-300">${art.price}</span>
                     )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-blue-400 text-sm font-medium">
                        <Eye size={14}/> 
                        {art.viewCount || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleStatus(art.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${isArtworkClaimedForAdmin(art) ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}
                    >
                      {getArtworkClaimAdminLabel(art)}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => handleEditArtwork(art)} className="text-gray-400 hover:text-white inline-block p-1">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDeleteArtwork(art.id)} className="text-gray-500 hover:text-red-400 inline-block p-1">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );})}
              </tbody>
            </table>
          </div>
        </>
          )}
        </div>
      )}

      {/* --- Appointment List --- */}
      {activeTab === 'appointments' && (
        <div>
          {/* 創建客製圖訂單按鈕 - 放在頁面頂部，更明顯 */}
          <div className="mb-6 flex justify-between items-center bg-card p-4 rounded-xl border border-white/5">
            <div>
              <h2 className="text-lg font-bold text-white">預約列表</h2>
              <p className="text-sm text-gray-400 mt-1">管理所有預約訂單</p>
            </div>
            <button
              onClick={() => setIsCustomOrderModalOpen(true)}
              className="bg-primary text-black font-bold px-6 py-3 rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Plus size={20} />
              創建客製圖訂單
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(ADMIN_APPOINTMENT_FILTER_LABELS) as AdminAppointmentFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setAppointmentFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  appointmentFilter === key
                    ? 'bg-primary text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                }`}
              >
                {ADMIN_APPOINTMENT_FILTER_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
             {appointmentsLoad.status === 'loading' && !appointmentsLoad.hasLoadedOnce ? (
                 <div className="text-center py-20 text-gray-400">預約資料載入中…</div>
             ) : appointmentsLoad.status === 'error' && !appointmentsLoad.hasLoadedOnce && appointments.length === 0 ? (
                 <div className="text-center py-20">
                   <p className="text-amber-300 mb-4">{appointmentsLoad.error || '預約資料載入失敗'}</p>
                   <button type="button" onClick={() => loadCoreData()} className="px-4 py-2 rounded-lg bg-primary text-black font-bold">重新載入</button>
                 </div>
             ) : filteredAppointments.length === 0 ? (
                 <div className="text-center py-20 text-gray-500">
                     {appointmentsLoad.hasLoadedOnce && appointments.length === 0 ? '目前沒有預約資料。' : '此篩選條件下沒有預約。'}
                 </div>
             ) : (
                <table className="w-full text-left">
                    <thead className="bg-dark text-gray-400 text-xs uppercase">
                    <tr>
                        <th className="px-6 py-4">日期與時間</th>
                        <th className="px-6 py-4">顧客資訊</th>
                        <th className="px-6 py-4">作品/備註</th>
                        <th className="px-6 py-4">狀態</th>
                        <th className="px-6 py-4 text-right">操作</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                    {filteredAppointments.map(apt => (
                        <tr key={apt.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-primary"/>
                                    <span className="text-white font-bold">{apt.date}</span>
                                    <span className="text-gray-400 text-sm">@ {apt.timeSlot}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <p className="font-bold text-white">{apt.customerName}</p>
                                {apt.phoneNumber && (
                                    <p className="text-xs text-primary flex items-center gap-1 mt-1">
                                        <Phone size={10}/> {apt.phoneNumber}
                                    </p>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-2">
                                    {/* 訂單類型標籤 */}
                                    {apt.orderType && (
                                        <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-xs font-bold ${
                                            apt.orderType === 'CUSTOM' 
                                                ? 'bg-purple-900/30 text-purple-400 border border-purple-900/50' 
                                                : 'bg-blue-900/30 text-blue-400 border border-blue-900/50'
                                        }`}>
                                            {apt.orderType === 'CUSTOM' ? '客製圖' : '認領圖'}
                                        </span>
                                    )}
                                    {/* 作品資訊 */}
                                    {apt.artworkTitle ? (
                                        <div className="flex items-center gap-2">
                                            {apt.artworkImage && (
                                                <img src={apt.artworkImage} className="w-8 h-8 rounded object-cover border border-white/10" alt="art"/>
                                            )}
                                            <div>
                                                {apt.artworkId ? (
                                                    <button
                                                        onClick={() => navigate(`/artwork/${apt.artworkId}`)}
                                                        className="text-white text-sm hover:text-primary transition-colors cursor-pointer text-left"
                                                    >
                                                        {apt.artworkTitle}
                                                    </button>
                                                ) : (
                                                    <p className="text-white text-sm">{apt.artworkTitle}</p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-sm italic">{apt.notes || '無備註'}</p>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`border px-2 py-1 rounded text-xs font-bold flex items-center w-fit gap-1 ${getAdminStatusBadgeClass(apt.status)}`}>
                                    {getAdminStatusLabel(apt.status)}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <AdminAppointmentActions
                                    apt={apt}
                                    openMenuId={openActionMenuId}
                                    setOpenMenuId={setOpenActionMenuId}
                                    onSetDeposit={openDepositModal}
                                    onConfirmReceivedDeposit={openReceiveDepositModal}
                                    onCopyDepositMessage={copyDepositMessage}
                                    onCopyConsentMessage={copyConsentMessage}
                                    onCompleteOrder={openCompleteModal}
                                    onCopyLink={copyAppointmentLink}
                                    onEdit={handleEditAppointment}
                                    onCancel={cancelAppointment}
                                    onUploadCustomImage={openCustomImageUpload}
                                    onViewConsent={(id) => navigate(`/consent/${id}`)}
                                />
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
             )}
          </div>
        </div>
      )}

      {/* --- Customers List --- */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {/* 搜尋列 */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="搜尋姓名、ID、標籤或收藏數（例如 >0、>=3）..."
                className="w-full bg-card border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-white text-sm placeholder-gray-500 focus:border-primary focus:outline-none"
              />
              {customerSearch && (
                <button
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-gray-400 text-sm flex-shrink-0">
              {(() => {
                const count = filteredCustomers.length;
                return `共 ${count} 位顧客`;
              })()}
            </span>
          </div>

        <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
          {customersLoad.status === 'loading' && !customersLoad.hasLoadedOnce ? (
            <div className="text-center py-20 text-gray-400">顧客資料載入中…</div>
          ) : customersLoad.status === 'error' && !customersLoad.hasLoadedOnce && customers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-amber-300 mb-4">{customersLoad.error || '顧客資料載入失敗'}</p>
              <button type="button" onClick={() => loadCoreData()} className="px-4 py-2 rounded-lg bg-primary text-black font-bold">重新載入</button>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              {customersLoad.hasLoadedOnce ? '目前沒有顧客資料。' : '顧客資料載入中…'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-dark text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4">顧客資訊</th>
                    <th className="px-6 py-4">標籤</th>
                    <th className="px-6 py-4">加入日期</th>
                    <th className="px-6 py-4">最後登入</th>
                    <th className="px-6 py-4">收藏數量</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {customer.avatarUrl ? (
                            <img 
                              src={customer.avatarUrl} 
                              alt={customer.name}
                              className="w-12 h-12 rounded-full border-2 border-primary object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center border-2 border-primary">
                              <User size={24} className="text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-white text-lg">{customer.name}</p>
                            <p className="text-xs text-gray-400">ID: {customer.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 items-center min-w-[140px]">
                          {(customerTagMap[customer.id] || []).map(tag => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          <button
                            onClick={() => setTagModalCustomer(customer)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-600 text-gray-400 hover:border-primary hover:text-primary transition-colors"
                          >
                            <Tag size={10} />
                            {(customerTagMap[customer.id] || []).length === 0 ? '設定標籤' : '編輯'}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-primary" />
                          <span className="text-white">
                            {customer.createdAt 
                              ? new Date(customer.createdAt).toLocaleDateString('zh-TW', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                              : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-blue-400" />
                          <span className="text-white">
                            {customer.lastLogin 
                              ? new Date(customer.lastLogin).toLocaleDateString('zh-TW', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : '從未登入'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Heart size={16} className="text-pink-500" />
                          <button
                            onClick={() => setFavoriteViewerCustomer(customer)}
                            className="text-white font-bold text-lg hover:text-pink-400 transition-colors underline-offset-4 hover:underline"
                          >
                            {customer.favoriteCount || 0}
                          </button>
                          <span className="text-gray-400 text-sm">件作品</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {customerSearch && filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-14 text-center text-gray-500">
                        找不到符合「{customerSearch}」的顧客
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
      )}

      {/* --- Lineart Tool --- */}
      {activeTab === 'lineart' && (
        <div>
          <LineartTool />
        </div>
      )}

      {/* --- Remove Background Tool --- */}
      {activeTab === 'removebg' && (
        <div>
          <RemoveBgTool />
        </div>
      )}

      {/* --- Analytics Dashboard --- */}
      {activeTab === 'analytics' && (
        <div>
          <AnalyticsTab key={brandRevision} />
        </div>
      )}

      {/* --- LINE 推播管理 --- */}
      {activeTab === 'line_messaging' && (
        <div>
          <LineMessagingTab
            customers={customers}
            customersLoad={customersLoad}
            memberTags={memberTags}
            memberTagsLoad={memberTagsLoad}
            onReloadCustomers={loadCoreData}
            onReloadTags={loadMemberTags}
          />
        </div>
      )}

      {/* --- Brand Settings (SUPER_ADMIN only) --- */}
      {activeTab === 'brand_settings' && isSuperAdmin && (
        <div>
          <AdminBrandSettingsPanel key={brandRevision} brandRevision={brandRevision} />
        </div>
      )}

      {/* --- Admin Users (SUPER_ADMIN only tab) --- */}
      {activeTab === 'admin_users' && isSuperAdmin && (
        <div>
          <AdminUsersPanel />
        </div>
      )}

      {/* --- Customer Favorite Artworks Modal --- */}
      {favoriteViewerCustomer && (
        <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-white/10 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">
                {favoriteViewerCustomer.name} 的收藏作品
              </h3>
              <button
                onClick={() => setFavoriteViewerCustomer(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              <p className="text-sm text-gray-400 mb-4">共 {favoriteViewerIds.length} 件收藏</p>

              {favoriteViewerArtworks.length === 0 ? (
                <div className="text-gray-500 text-center py-10">此會員目前沒有可顯示的收藏作品</div>
              ) : (
                <div className="space-y-3">
                  {favoriteViewerArtworks.map((art) => (
                    <div key={art.id} className="flex items-center gap-3 bg-dark/50 rounded-xl border border-white/5 p-3">
                      <img
                        src={art.imageUrl}
                        alt={art.title}
                        className="w-14 h-14 rounded-lg object-cover border border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{art.title}</p>
                        <p className="text-xs text-gray-500 truncate">ID: {art.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {missingFavoriteCount > 0 && (
                <p className="text-xs text-amber-400 mt-4">
                  另有 {missingFavoriteCount} 件收藏作品已不存在或已下架，無法顯示。
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Customer Tag Modal --- */}
      {tagModalCustomer && (
        <CustomerTagModal
          customer={tagModalCustomer}
          tags={memberTags}
          onClose={() => setTagModalCustomer(null)}
          onSaved={() => {
            setTagModalCustomer(null);
            loadCustomerTags(customers);
          }}
        />
      )}

      {/* --- Upload Modal --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{editingId ? '編輯作品' : '上傳新作品'}</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white"><X /></button>
            </div>
            {currentAdminBrand && (
              <div className="px-6 pt-4">
                <p className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  目前上架品牌：<strong>{currentAdminBrand.name}</strong>
                </p>
              </div>
            )}
            
            <form onSubmit={handleSubmitArtwork} className="p-6 space-y-6">
              
              {/* Image Upload - 最多3張 */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">作品圖片（最多 3 張，第一張為封面）</label>
                <div className="grid grid-cols-3 gap-3">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="relative border-2 border-gray-700 rounded-xl overflow-hidden aspect-square bg-dark">
                      <img src={url} alt={`圖片 ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 bg-primary text-black text-[10px] font-bold px-1.5 py-0.5 rounded">封面</span>
                      )}
                      <button 
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full hover:bg-red-500 z-10"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {imageUrls.length < 3 && (
                    <div className="border-2 border-dashed border-gray-700 rounded-xl aspect-square flex items-center justify-center hover:border-primary transition-colors cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="text-gray-500 text-center">
                        <Plus className="mx-auto mb-1" size={24} />
                        <p className="text-xs">{imageUrls.length === 0 ? '上傳圖片' : '新增圖片'}</p>
                        <p className="text-[10px] text-gray-600">{imageUrls.length}/3</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-dark/40 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">預覽與尺寸資料</h3>
                  <p className="text-xs text-gray-500 mt-1">供 Tattoo Preview 與未來 3D Preview 使用</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">透明 PNG</label>

                  <div className="rounded-lg border border-white/10 bg-dark/60 p-3 mb-3 space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoGeneratePng}
                        onChange={(e) => setAutoGeneratePng(e.target.checked)}
                        className="mt-1 accent-primary"
                      />
                      <span>
                        <span className="text-sm text-white block">自動產生透明 PNG</span>
                        <span className="text-xs text-gray-500 block mt-1">
                          使用自動去背的預設參數，儲存作品時自動產生透明 PNG。
                        </span>
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 pl-7">
                      目前預設：{formatRemoveBgPresetSummary(removeBgPreset, { isSystemDefault: !hasCustomRemoveBgPreset })}
                    </p>
                    {!hasCustomRemoveBgPreset && (
                      <p className="text-xs text-amber-300/90 pl-7">目前使用系統預設，可至自動去背頁調整。</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setActiveTab('removebg');
                      }}
                      className="text-xs text-primary hover:underline pl-7"
                    >
                      前往調整去背預設
                    </button>
                    {autoGeneratePng && !manualPngUploaded && getCoverImageSource() && (
                      <div className="pl-7 space-y-2">
                        <p className="text-xs text-emerald-400">✓ 將自動產生 PNG</p>
                        <button
                          type="button"
                          onClick={handlePreviewAutoPng}
                          disabled={isPreviewingAutoPng || isSubmittingArtwork}
                          className="text-xs px-3 py-1.5 rounded border border-white/10 text-gray-300 hover:text-white hover:border-white/20 disabled:opacity-50"
                        >
                          {isPreviewingAutoPng ? '預覽產生中...' : '預覽結果'}
                        </button>
                        {autoPngPreviewUrl && (
                          <img src={autoPngPreviewUrl} alt="自動去背預覽" className="h-20 object-contain bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzJhMmEyYSIvPgo8cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzJhMmEyYSIvPgo8L3N2Zz4=')] rounded border border-white/10" />
                        )}
                        {autoPngColorNote && (
                          <p className="text-xs text-amber-300/90">{autoPngColorNote}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center hover:border-green-500 transition-colors cursor-pointer relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzJhMmEyYSIvPgo8cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzJhMmEyYSIvPgo8L3N2Zz4=')]">
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handlePngChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {pngUrl ? (
                      <div className="relative inline-block">
                        <img src={pngUrl} alt="PNG Preview" className="mx-auto h-24 object-contain" />
                        <p className="text-xs text-emerald-400 mt-2">✓ 已有透明 PNG</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPngUrl('');
                            setManualPngUploaded(false);
                            clearAutoPngPreview();
                          }}
                          className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-full hover:bg-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="text-gray-500 flex items-center justify-center gap-3">
                        <Layers className="text-amber-400" size={20} />
                        <div className="text-left">
                          <p className="font-medium text-amber-300 text-sm">⚠ 尚未上傳 PNG</p>
                          <p className="text-xs">點擊手動上傳透明去背檔</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {pngUrl && (
                    <button
                      type="button"
                      onClick={handleRegeneratePng}
                      disabled={isRegeneratingPng || isSubmittingArtwork || !getCoverImageSource()}
                      className="mt-2 text-xs px-3 py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      {isRegeneratingPng ? '重新產生中...' : '重新產生 PNG'}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">建議長度</label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={heightCm}
                      onChange={e => setHeightCm(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded p-2 text-white"
                      placeholder="24.8"
                    />
                    <span className="text-sm text-gray-400 shrink-0">cm</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">尺寸補充說明 (選填)</label>
                  <input
                    type="text"
                    value={sizeNote}
                    onChange={e => setSizeNote(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white"
                    placeholder="例如：依刺青師建議可微調"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">建議施作部位</label>
                  <div className="flex flex-wrap gap-2">
                    {ARTWORK_PLACEMENT_OPTIONS.map((option) => {
                      const selected = selectedPlacementKeys.includes(option.key);
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => togglePlacementKey(option.key)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                            selected
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-dark border-gray-700 text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {legacyPlacements.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-700/30 bg-amber-900/10 px-3 py-2">
                      <p className="text-xs text-amber-300 mb-1">舊資料（請重新選擇標準部位後儲存）</p>
                      <p className="text-xs text-amber-100/90">{legacyPlacements.join('、')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">作品名稱</label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-dark/30 p-4">
                <label className="block text-sm font-bold text-gray-300 mb-3">作品分類</label>
                <ArtworkTagSelector
                  tagsByGroup={taxonomyCatalog.tagsByGroup}
                  selectedTagIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                  activeOnly
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-dark/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-gray-300">新上架作品</p>
                    <p className="text-xs text-gray-500 mt-1">開啟後，此作品會出現在前台「新上架」快速篩選。</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isNewArrival}
                    onClick={() => setIsNewArrival((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
                      isNewArrival ? 'bg-primary' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform mt-1 ${
                        isNewArrival ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">原價</label>
                  <input 
                    type="number" 
                    value={price} 
                    onChange={e => setPrice(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white"
                    placeholder="3000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">特價 (選填)</label>
                  <input 
                    type="number" 
                    value={specialPrice} 
                    onChange={e => setSpecialPrice(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white"
                    placeholder="2500"
                  />
                </div>
              </div>

              {/* AI Section */}
              <div className="bg-dark/50 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                    <Sparkles size={14} className="text-primary" /> AI 描述生成
                  </label>
                  <button 
                    type="button" 
                    onClick={handleAiGenerate}
                    disabled={!title || aiLoading}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {aiLoading ? '生成中...' : '自動生成'}
                  </button>
                </div>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-black/20 border border-gray-700 rounded p-2 text-sm text-gray-300 h-24"
                  placeholder="輸入標題後點擊自動生成，或手動輸入..."
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">#{tag}</span>
                  ))}
                </div>
              </div>

              {artworkSubmitStatus && (
                <p className="text-sm text-primary text-center">{artworkSubmitStatus}</p>
              )}

              <button 
                type="submit" 
                disabled={isSubmittingArtwork || isRegeneratingPng}
                className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
              >
                {isSubmittingArtwork ? '處理中...' : '儲存作品'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Appointment Edit Modal --- */}
      {isAptModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-white/10 my-4 max-h-[90vh] flex flex-col">
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-dark/50 shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Edit size={18} className="text-primary"/> 編輯預約
                    </h2>
                    <button onClick={() => setIsAptModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                </div>
                <form onSubmit={handleSaveAppointment} className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">日期</label>
                            <input 
                                type="date" 
                                value={aptForm.date} 
                                onChange={e => setAptForm({...aptForm, date: e.target.value})}
                                className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-primary focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">時間</label>
                            <input 
                                type="time" 
                                value={aptForm.timeSlot} 
                                onChange={e => setAptForm({...aptForm, timeSlot: e.target.value})}
                                className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-primary focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">狀態</label>
                        <select 
                            value={aptForm.status} 
                            onChange={e => setAptForm({...aptForm, status: e.target.value as any})}
                            className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-primary focus:outline-none"
                        >
                            <option value="PENDING">PENDING (待審核)</option>
                            <option value="WAITING_PAYMENT">WAITING_PAYMENT (待付款)</option>
                            <option value="SIGNING">SIGNING (簽屬中)</option>
                            <option value="SIGNED">SIGNED (簽屬完成)</option>
                            <option value="BOOKED">BOOKED (已確認)</option>
                            <option value="COMPLETED">COMPLETED (已完成)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><User size={12}/> 顧客姓名</label>
                        <input 
                            type="text" 
                            value={aptForm.customerName} 
                            onChange={e => setAptForm({...aptForm, customerName: e.target.value})}
                            className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-primary focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Phone size={12}/> 手機號碼</label>
                        <input 
                            type="tel" 
                            value={aptForm.phoneNumber} 
                            onChange={e => setAptForm({...aptForm, phoneNumber: e.target.value})}
                            className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-primary focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><FileText size={12}/> 作品 / 資訊</label>
                        <input 
                            type="text" 
                            value={aptForm.artworkTitle} 
                            onChange={e => setAptForm({...aptForm, artworkTitle: e.target.value})}
                            placeholder="作品名稱或描述"
                            className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-primary focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">備註</label>
                        <textarea 
                            value={aptForm.notes} 
                            onChange={e => setAptForm({...aptForm, notes: e.target.value})}
                            className="w-full bg-dark border border-gray-700 rounded p-2 text-white h-16 text-sm focus:border-primary focus:outline-none resize-none"
                        />
                    </div>

                    {/* 價格區塊 */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">💰 總價 (NT$)</label>
                            <input 
                                type="number" 
                                value={aptForm.totalPrice} 
                                onChange={e => setAptForm({...aptForm, totalPrice: e.target.value})}
                                placeholder="例如: 5000"
                                className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-primary focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">✅ 已付訂金 (NT$)</label>
                            <input 
                                type="number" 
                                value={aptForm.depositPaid} 
                                onChange={e => setAptForm({...aptForm, depositPaid: e.target.value})}
                                placeholder="例如: 1000"
                                className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-primary focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* 同意書區塊 */}
                    <div className="pt-4 border-t border-gray-700">
                        <h4 className="text-sm font-bold text-primary mb-3">📋 同意書資訊</h4>
                        
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">紋身部位</label>
                                <input 
                                    type="text" 
                                    value={aptForm.tattooPosition} 
                                    onChange={e => setAptForm({...aptForm, tattooPosition: e.target.value})}
                                    placeholder="例如: 手臂內側"
                                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">大小</label>
                                <input 
                                    type="text" 
                                    value={aptForm.tattooSize} 
                                    onChange={e => setAptForm({...aptForm, tattooSize: e.target.value})}
                                    placeholder="例如: 10x10 cm"
                                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>
                        
                        <div className="mb-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">色彩</label>
                            <input 
                                type="text" 
                                value={aptForm.tattooColor} 
                                onChange={e => setAptForm({...aptForm, tattooColor: e.target.value})}
                                placeholder="例如: 黑灰、彩色"
                                className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-sm focus:border-primary focus:outline-none"
                            />
                        </div>
                        
                        <div className="mb-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">同意書備註</label>
                            <textarea 
                                value={aptForm.consentNotes} 
                                onChange={e => setAptForm({...aptForm, consentNotes: e.target.value})}
                                placeholder="其他需要在同意書上顯示的資訊..."
                                className="w-full bg-dark border border-gray-700 rounded p-2 text-white h-12 text-sm focus:border-primary focus:outline-none resize-none"
                            />
                        </div>

                        {/* 同意書連結與狀態 */}
                        {editingApt && (
                            <div className="bg-dark/50 p-3 rounded-lg border border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-gray-400">同意書連結：</span>
                                    <button 
                                        type="button"
                                        onClick={() => copyConsentLink(editingApt.id)}
                                        className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded hover:bg-blue-900/50"
                                    >
                                        📋 複製連結
                                    </button>
                                </div>
                                {editingApt.signedAt ? (
                                    <div className="text-xs text-green-400 bg-green-900/20 p-2 rounded">
                                        ✅ 已簽署：{editingApt.signedAt} 
                                        <span className="text-gray-400 ml-2">({editingApt.signerName})</span>
                                    </div>
                                ) : (
                                    <div className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded">
                                        ⏳ 尚未簽署
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                         <button 
                            type="submit"
                            className="bg-primary text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-500 flex items-center gap-2"
                        >
                            <Save size={18}/> 儲存變更
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- 設定訂金 Modal --- */}
      {isDepositModalOpen && confirmingApt && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-white/10">
                  <div className="p-5 border-b border-white/10 flex justify-between items-center bg-dark/50">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <DollarSign size={18} className="text-primary"/> 設定訂金
                      </h2>
                      <button onClick={() => { setIsDepositModalOpen(false); setConfirmingApt(null); setDepositAmount(''); }} className="text-gray-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <p className="text-sm text-gray-300 mb-3">顧客：{confirmingApt.customerName}</p>
                          {confirmingApt.artworkTitle && (
                            <p className="text-sm text-gray-400 mb-3">作品：{confirmingApt.artworkTitle}</p>
                          )}
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                              訂金金額 NT$
                          </label>
                          <input 
                              type="number" 
                              value={depositAmount}
                              onChange={e => setDepositAmount(e.target.value)}
                              placeholder="例如: 1000"
                              className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white text-lg focus:border-primary focus:outline-none"
                              autoFocus
                              required
                          />
                          {confirmingApt.totalPrice && (
                              <p className="text-xs text-gray-500 mt-1">
                                  總價：NT$ {confirmingApt.totalPrice.toLocaleString()}
                              </p>
                          )}
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button 
                              onClick={() => { setIsDepositModalOpen(false); setConfirmingApt(null); setDepositAmount(''); }}
                              className="flex-1 bg-gray-700 text-gray-300 font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors"
                          >
                              取消
                          </button>
                          <button 
                              onClick={confirmDeposit}
                              className="flex-1 bg-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors"
                          >
                              儲存訂金
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- 確認已收訂金 Modal --- */}
      {isReceiveDepositModalOpen && receiveDepositApt && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-white/10">
                  <div className="p-5 border-b border-white/10 flex justify-between items-center bg-dark/50">
                      <h2 className="text-lg font-bold text-white">確認已收到訂金？</h2>
                      <button onClick={() => { setIsReceiveDepositModalOpen(false); setReceiveDepositApt(null); }} className="text-gray-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 space-y-2 text-sm">
                          <p className="text-white"><span className="text-gray-500">顧客：</span>{receiveDepositApt.customerName}</p>
                          <p className="text-white"><span className="text-gray-500">作品：</span>{receiveDepositApt.artworkTitle || '—'}</p>
                          <p className="text-white"><span className="text-gray-500">預約：</span>{receiveDepositApt.date} @ {receiveDepositApt.timeSlot}</p>
                          <p className="text-primary font-bold"><span className="text-gray-500 font-normal">訂金：</span>NT$ {(receiveDepositApt.depositPaid || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                          <p>確認後：</p>
                          <p>✓ Artwork 正式標記為已認領</p>
                          <p>✓ Reservation 進入後續處理</p>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button
                              onClick={() => { setIsReceiveDepositModalOpen(false); setReceiveDepositApt(null); }}
                              className="flex-1 bg-gray-700 text-gray-300 font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors"
                          >
                              取消
                          </button>
                          <button
                              onClick={confirmReceivedDeposit}
                              className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors"
                          >
                              確認已收訂金
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- 完成訂單 Modal --- */}
      {isCompleteModalOpen && completingApt && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-white/10">
                  <div className="p-5 border-b border-white/10 flex justify-between items-center bg-dark/50">
                      <h2 className="text-lg font-bold text-white">完成這筆訂單？</h2>
                      <button onClick={() => { setIsCompleteModalOpen(false); setCompletingApt(null); }} className="text-gray-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 space-y-2 text-sm">
                          <p className="text-white"><span className="text-gray-500">顧客：</span>{completingApt.customerName}</p>
                          <p className="text-white"><span className="text-gray-500">作品：</span>{completingApt.artworkTitle || '—'}</p>
                          <p className="text-white"><span className="text-gray-500">預約：</span>{completingApt.date} @ {completingApt.timeSlot}</p>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                          <p>完成後：</p>
                          <p>✓ 訂單標記為已完成</p>
                          <p>✓ Artwork 維持已認領</p>
                          <p>✓ 不再列入待處理</p>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button
                              onClick={() => { setIsCompleteModalOpen(false); setCompletingApt(null); }}
                              className="flex-1 bg-gray-700 text-gray-300 font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors"
                          >
                              取消
                          </button>
                          <button
                              onClick={confirmCompleteOrder}
                              className="flex-1 bg-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors"
                          >
                              完成訂單
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isCatManagerOpen && (
        <ArtworkTaxonomyManager
          onClose={() => {
            setIsCatManagerOpen(false);
            loadTaxonomyCatalog();
          }}
        />
      )}

      {/* --- Custom Order Modal --- */}
      {isCustomOrderModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">創建客製圖訂單</h2>
                <p className="text-sm text-gray-400 mt-1">客製圖流程：開單 → 收訂金 → 製作 → 上傳圖片 → 傳送同意書</p>
              </div>
              <button 
                onClick={() => {
                  setIsCustomOrderModalOpen(false);
                  setCustomOrderForm({
                      selectedCustomerId: '',
                      totalPrice: '',
                      depositAmount: '',
                      notes: ''
                  });
                }} 
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* 步驟 1：選擇顧客 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <span className="bg-primary text-black px-2 py-0.5 rounded text-xs mr-2">步驟 1</span>
                  選擇顧客 <span className="text-red-400">*</span>
                </label>
                <select
                  value={customOrderForm.selectedCustomerId}
                  onChange={(e) => setCustomOrderForm({...customOrderForm, selectedCustomerId: e.target.value})}
                  className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"
                  required
                >
                  <option value="">請選擇顧客</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {customOrderForm.selectedCustomerId && (
                  <div className="mt-3 flex items-center gap-3 p-3 bg-dark rounded-lg border border-white/5">
                    {(() => {
                      const selectedCust = customers.find(c => c.id === customOrderForm.selectedCustomerId);
                      return selectedCust ? (
                        <>
                          {selectedCust.avatarUrl ? (
                            <img src={selectedCust.avatarUrl} alt={selectedCust.name} className="w-12 h-12 rounded-full border-2 border-primary object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center border-2 border-primary">
                              <User size={24} className="text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-white font-bold">{selectedCust.name}</p>
                            <p className="text-gray-400 text-sm">ID: {selectedCust.id}</p>
                          </div>
                        </>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              {/* 步驟 2：填寫金額 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <span className="bg-primary text-black px-2 py-0.5 rounded text-xs mr-2">步驟 2</span>
                    總金額 <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={customOrderForm.totalPrice}
                      onChange={(e) => setCustomOrderForm({...customOrderForm, totalPrice: e.target.value})}
                      className="w-full bg-dark border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:border-primary focus:outline-none"
                      placeholder="例：5000"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    訂金金額 <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={customOrderForm.depositAmount}
                      onChange={(e) => setCustomOrderForm({...customOrderForm, depositAmount: e.target.value})}
                      className="w-full bg-dark border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:border-primary focus:outline-none"
                      placeholder="例：2000"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 步驟 3：備註 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <span className="bg-primary text-black px-2 py-0.5 rounded text-xs mr-2">步驟 3</span>
                  客製圖備註（選填）
                </label>
                <textarea
                  value={customOrderForm.notes}
                  onChange={(e) => setCustomOrderForm({...customOrderForm, notes: e.target.value})}
                  className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none resize-none"
                  rows={3}
                  placeholder="例：客人想要的圖案描述、尺寸、位置等..."
                />
              </div>

              {/* 提示訊息 */}
              <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4">
                <p className="text-blue-400 text-sm">
                  <strong>💡 提示：</strong>創建訂單後，系統會自動進入「待付款」狀態。
                  您可以複製訂金訊息傳送給客人，收到訂金後再點擊「已收到訂金」。
                </p>
              </div>

              {/* 按鈕 */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateCustomOrder}
                  className="flex-1 bg-primary text-black font-bold px-4 py-3 rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  創建客製圖訂單
                </button>
                <button
                  onClick={() => {
                    setIsCustomOrderModalOpen(false);
                    setCustomOrderForm({
                        selectedCustomerId: '',
                        totalPrice: '',
                        depositAmount: '',
                        notes: ''
                    });
                  }}
                  className="flex-1 bg-gray-700 text-white font-bold px-4 py-3 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Custom Image Upload Modal --- */}
      {isCustomImageModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-white/10">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">上傳客製圖片</h2>
              <button 
                onClick={() => {
                  setIsCustomImageModalOpen(false);
                  setUploadingAptId(null);
                  setCustomImageUrl('');
                }} 
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleCustomImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {customImageUrl ? (
                  <img src={customImageUrl} alt="客製圖預覽" className="mx-auto max-h-60 object-contain rounded-lg" />
                ) : (
                  <div className="text-gray-500">
                    <Plus className="mx-auto mb-2" size={32} />
                    <p className="font-medium">點擊上傳客製圖片</p>
                    <p className="text-xs mt-1">支援 JPG、PNG 格式</p>
                  </div>
                )}
              </div>

              <div className="bg-green-900/20 border border-green-900/50 rounded-lg p-4">
                <p className="text-green-400 text-sm">
                  <strong>💡 提示：</strong>上傳圖片後，您可以傳送同意書連結給客人進行簽署。
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveCustomImage}
                  disabled={!customImageUrl}
                  className={`flex-1 font-bold px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    customImageUrl 
                      ? 'bg-primary text-black hover:bg-yellow-500' 
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Save size={20} />
                  儲存圖片
                </button>
                <button
                  onClick={() => {
                    setIsCustomImageModalOpen(false);
                    setUploadingAptId(null);
                    setCustomImageUrl('');
                  }}
                  className="flex-1 bg-gray-700 text-white font-bold px-4 py-3 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isCatManagerOpen && (
        <ArtworkTaxonomyManager
          onClose={() => {
            setIsCatManagerOpen(false);
            void loadTaxonomyCatalog();
            void loadCategories();
          }}
        />
      )}

      <BatchPngRegenerator
        open={isBatchPngOpen}
        onClose={() => setIsBatchPngOpen(false)}
        artworks={artworks}
        preset={removeBgPreset}
        isSystemDefaultPreset={!hasCustomRemoveBgPreset}
        currentAdminBrand={currentAdminBrand}
        onFinished={() => loadData()}
      />

      <TaxonomyMigrationPanel
        open={isTaxonomyMigrationOpen}
        onClose={() => setIsTaxonomyMigrationOpen(false)}
        currentAdminBrand={currentAdminBrand}
        onFinished={() => { loadData(); void loadTaxonomyCatalog(); }}
      />
    </div>
  );
};

export default AdminDashboard;
