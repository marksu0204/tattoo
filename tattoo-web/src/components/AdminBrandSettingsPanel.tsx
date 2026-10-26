import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { db } from '../services/mockBackend';
import type { AdminBrandPresentation } from '../types';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

type FormState = Omit<AdminBrandPresentation, 'code' | 'isActive'>;

const emptyForm = (): FormState => ({
  name: '',
  logoUrl: null,
  primaryColor: '#D4AF37',
  accentColor: '#121212',
  instagramUrl: null,
  lineUrl: null,
  seoSiteName: '',
  seoDefaultDescription: '',
  regionLabel: null,
});

const presentationToForm = (p: AdminBrandPresentation): FormState => ({
  name: p.name,
  logoUrl: p.logoUrl,
  primaryColor: p.primaryColor,
  accentColor: p.accentColor,
  instagramUrl: p.instagramUrl,
  lineUrl: p.lineUrl,
  seoSiteName: p.seoSiteName,
  seoDefaultDescription: p.seoDefaultDescription,
  regionLabel: p.regionLabel,
});

interface AdminBrandSettingsPanelProps {
  brandRevision: number;
}

const AdminBrandSettingsPanel: React.FC<AdminBrandSettingsPanelProps> = ({ brandRevision }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [readonlyMeta, setReadonlyMeta] = useState<{ code: string; isActive: boolean } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const loadRequestRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPresentation = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    setSaveNotice(null);
    try {
      const data = await db.getAdminBrandPresentation();
      if (requestId !== loadRequestRef.current) return;
      setReadonlyMeta({ code: data.code, isActive: data.isActive });
      setForm(presentationToForm(data));
    } catch (e) {
      if (requestId !== loadRequestRef.current) return;
      setError(e instanceof Error ? e.message : '無法載入品牌設定');
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPresentation();
  }, [loadPresentation, brandRevision]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveNotice(null);
  };

  const normalizeOptionalUrlInput = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };

  const handleColorTextChange = (key: 'primaryColor' | 'accentColor', value: string) => {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      updateField(key, trimmed.toUpperCase());
    }
  };

  const handleColorPickerChange = (key: 'primaryColor' | 'accentColor', value: string) => {
    updateField(key, value.toUpperCase());
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      alert('Logo 僅支援 PNG、JPG、JPEG、WebP 格式');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      alert('Logo 檔案不可超過 5MB');
      return;
    }

    setUploadingLogo(true);
    setSaveNotice(null);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('讀取檔案失敗'));
        reader.readAsDataURL(file);
      });
      const url = await db.uploadImage(dataUrl, file.type === 'image/png');
      updateField('logoUrl', url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Logo 上傳失敗');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    updateField('logoUrl', null);
  };

  const validateForm = (): string | null => {
    const name = form.name.trim();
    if (!name || name.length > 80) return '品牌名稱必填，且不可超過 80 字';
    if (!HEX_COLOR.test(form.primaryColor)) return '主色須為 #RRGGBB 格式';
    if (!HEX_COLOR.test(form.accentColor)) return '輔助色須為 #RRGGBB 格式';
    const seoName = form.seoSiteName.trim();
    if (!seoName || seoName.length > 120) return 'SEO 網站名稱必填，且不可超過 120 字';
    if (form.seoDefaultDescription.trim().length > 300) return 'SEO 預設描述不可超過 300 字';
    if (form.regionLabel && form.regionLabel.trim().length > 120) return '地區名稱不可超過 120 字';
    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      alert(validationError);
      return;
    }

    setSaving(true);
    setSaveNotice(null);
    setError(null);
    try {
      const payload: FormState = {
        name: form.name.trim(),
        logoUrl: form.logoUrl,
        primaryColor: form.primaryColor.toUpperCase(),
        accentColor: form.accentColor.toUpperCase(),
        instagramUrl: normalizeOptionalUrlInput(form.instagramUrl ?? ''),
        lineUrl: normalizeOptionalUrlInput(form.lineUrl ?? ''),
        seoSiteName: form.seoSiteName.trim(),
        seoDefaultDescription: form.seoDefaultDescription.trim(),
        regionLabel: normalizeOptionalUrlInput(form.regionLabel ?? ''),
      };
      const updated = await db.updateAdminBrandPresentation(payload);
      setReadonlyMeta({ code: updated.code, isActive: updated.isActive });
      setForm(presentationToForm(updated));
      setSaveNotice('品牌設定已儲存，前台重新整理後生效。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <RefreshCw className="mx-auto mb-3 animate-spin" size={24} />
        品牌設定載入中…
      </div>
    );
  }

  if (error && !readonlyMeta) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center">
        <p className="text-red-200 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => void loadPresentation()}
          className="px-4 py-2 rounded-lg bg-primary text-black font-bold"
        >
          重新載入
        </button>
      </div>
    );
  }

  const activeLabel = readonlyMeta?.isActive ? '已啟用' : '尚未啟用';

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Image size={20} className="text-primary" />
          品牌設定
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          目前編輯：<span className="text-white">{form.name || '—'}</span>
          <span className="mx-2 text-gray-600">·</span>
          公開狀態：<span className={readonlyMeta?.isActive ? 'text-emerald-400' : 'text-amber-300'}>{activeLabel}</span>
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {saveNotice && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {saveNotice}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 bg-card rounded-xl border border-white/5 p-6">
        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Logo</label>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-24 h-24 rounded-xl border border-white/10 bg-dark/50 flex items-center justify-center overflow-hidden shrink-0">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="品牌 Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <Image size={32} className="text-gray-600" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <button
                type="button"
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium"
              >
                <Upload size={16} />
                {uploadingLogo ? '上傳中…' : '上傳 Logo'}
              </button>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 text-sm"
                >
                  <Trash2 size={16} />
                  移除 Logo
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">支援 PNG、JPG、WebP，最大 5MB</p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">品牌名稱</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            maxLength={80}
            required
            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none"
          />
        </div>

        {/* Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">主色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_COLOR.test(form.primaryColor) ? form.primaryColor : '#D4AF37'}
                onChange={(e) => handleColorPickerChange('primaryColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-700 bg-transparent"
              />
              <input
                type="text"
                value={form.primaryColor}
                onChange={(e) => handleColorTextChange('primaryColor', e.target.value)}
                placeholder="#RRGGBB"
                className="flex-1 bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">輔助色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_COLOR.test(form.accentColor) ? form.accentColor : '#121212'}
                onChange={(e) => handleColorPickerChange('accentColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-700 bg-transparent"
              />
              <input
                type="text"
                value={form.accentColor}
                onChange={(e) => handleColorTextChange('accentColor', e.target.value)}
                placeholder="#RRGGBB"
                className="flex-1 bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Contact URLs */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Instagram URL</label>
          <input
            type="url"
            value={form.instagramUrl ?? ''}
            onChange={(e) => updateField('instagramUrl', e.target.value)}
            placeholder="https://www.instagram.com/..."
            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">LINE URL</label>
          <input
            type="url"
            value={form.lineUrl ?? ''}
            onChange={(e) => updateField('lineUrl', e.target.value)}
            placeholder="https://line.me/R/ti/p/@..."
            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none"
          />
        </div>

        {/* SEO */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">SEO 網站名稱</label>
          <input
            type="text"
            value={form.seoSiteName}
            onChange={(e) => updateField('seoSiteName', e.target.value)}
            maxLength={120}
            required
            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">SEO 預設描述</label>
          <textarea
            value={form.seoDefaultDescription}
            onChange={(e) => updateField('seoDefaultDescription', e.target.value)}
            maxLength={300}
            rows={3}
            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none resize-none"
          />
        </div>

        {/* Region */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">地區名稱</label>
          <input
            type="text"
            value={form.regionLabel ?? ''}
            onChange={(e) => updateField('regionLabel', e.target.value)}
            maxLength={120}
            placeholder="例：台南市東區"
            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none"
          />
        </div>

        {/* Readonly security info */}
        <div className="rounded-lg border border-white/5 bg-dark/40 px-4 py-3 text-sm text-gray-400 space-y-1">
          <p>
            品牌代碼：<span className="text-gray-200 font-mono">{readonlyMeta?.code ?? '—'}</span>
          </p>
          <p>
            公開狀態：<span className={readonlyMeta?.isActive ? 'text-emerald-400' : 'text-amber-300'}>{activeLabel}</span>
            <span className="text-gray-600 ml-2">（不可在此修改）</span>
          </p>
        </div>

        <button
          type="submit"
          disabled={saving || uploadingLogo}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-black font-bold px-6 py-3 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? '儲存中…' : '儲存設定'}
        </button>
      </form>
    </div>
  );
};

export default AdminBrandSettingsPanel;
