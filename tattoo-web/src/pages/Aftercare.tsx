
import React, { useCallback, useEffect, useState } from 'react';
import LineEntryButton from '../components/LineEntryButton';
import { Link, useSearchParams } from 'react-router-dom';
import { db, hasAdminToken } from '../services/mockBackend';
import { useBrand } from '../context/BrandContext';
import { getAftercareContactNote, getAftercareEmptyMessage, getAftercareHeading, getAftercareSubtitle } from '../utils/brandPresentation';
import { Save, ShieldCheck } from 'lucide-react';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildAftercareSeo } from '../utils/seoConfig';
import { getAdminIdentity, getSavedAdminBrandCode } from '../utils/adminAuth';
import {
  canUseAftercareAdminEditMode,
  isAftercareAdminEditRequested,
  shouldShowAftercareAdminEditor,
} from '../utils/aftercareAdminMode';

const Aftercare: React.FC = () => {
  const { brand } = useBrand();
  const [searchParams] = useSearchParams();
  const adminEditRequested = isAftercareAdminEditRequested(searchParams);
  const isSuperAdmin = getAdminIdentity()?.isSuperAdmin === true;
  const isAdminEditMode = canUseAftercareAdminEditMode({
    adminEditRequested,
    hasAdminToken: hasAdminToken(),
    isSuperAdmin,
  });

  usePageSeo(buildAftercareSeo(brand));
  const aftercareContactNote = getAftercareContactNote(brand);

  const [content, setContent] = useState('');
  const [isConfigured, setIsConfigured] = useState(true);
  const [editedContent, setEditedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [adminBrandName, setAdminBrandName] = useState<string | null>(null);
  const [adminBrandCode, setAdminBrandCode] = useState<string | null>(() => getSavedAdminBrandCode());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadPublicContent = useCallback(async () => {
    setIsLoading(true);
    const result = await db.getAftercareContent();
    setContent(result.content);
    setEditedContent(result.content);
    setIsConfigured(result.configured);
    setIsLoading(false);
  }, []);

  const loadAdminContent = useCallback(async () => {
    setIsLoading(true);
    setSaveMessage(null);
    try {
      const [result, context] = await Promise.all([
        db.getAdminAftercareContent(),
        db.getAdminContext(),
      ]);
      setContent(result.content);
      setEditedContent(result.content);
      setIsConfigured(result.configured);
      setAdminBrandName(context.currentBrand.name);
      setAdminBrandCode(context.currentBrand.code);
    } catch (e) {
      console.error('Failed to load admin aftercare:', e);
      setContent('');
      setEditedContent('');
      setIsConfigured(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminEditMode) {
      void loadAdminContent();
    } else {
      void loadPublicContent();
    }
  }, [brand?.code, isAdminEditMode, adminBrandCode, loadAdminContent, loadPublicContent]);

  useEffect(() => {
    if (!isAdminEditMode) return;

    const syncAdminBrand = () => {
      setAdminBrandCode(getSavedAdminBrandCode());
    };

    window.addEventListener('storage', syncAdminBrand);
    return () => window.removeEventListener('storage', syncAdminBrand);
  }, [isAdminEditMode]);

  const handleSave = async () => {
    if (!isAdminEditMode) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await db.saveAftercareContent(editedContent);
      await loadAdminContent();
      setSaveMessage('儲存成功');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setSaveMessage(`儲存失敗：${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const showAdminEditor = shouldShowAftercareAdminEditor({ isAdminEditMode });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">

      <div className="flex flex-col gap-4 justify-between items-start mb-8 border-b border-white/10 pb-6">
        <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-3">
               <ShieldCheck className="text-primary" size={32} />
               {getAftercareHeading(brand)}
            </h1>
            <p className="text-gray-400">{getAftercareSubtitle(brand)}</p>
        </div>

        {showAdminEditor && adminBrandName && (
          <div className="w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            目前編輯品牌：{adminBrandName}
          </div>
        )}

        {showAdminEditor && (
          <Link
            to="/admin"
            className="text-sm text-gray-400 hover:text-white underline"
          >
            返回管理後台
          </Link>
        )}
      </div>

      {isLoading ? (
          <div className="text-center py-20 text-gray-500">正在載入資訊...</div>
      ) : (
          <>
            {showAdminEditor ? (
                <div className="bg-card p-6 rounded-xl border border-primary/30 shadow-2xl">
                    <label className="block text-sm text-primary font-bold mb-2">編輯文字內容</label>
                    {!isConfigured && !editedContent.trim() && (
                      <p className="text-sm text-gray-400 mb-3">此品牌尚未設定保養須知，儲存後即可在公開頁顯示。</p>
                    )}
                    <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full h-[60vh] bg-dark border border-gray-700 rounded-lg p-4 text-white font-sans text-lg leading-relaxed focus:border-primary focus:outline-none resize-none"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
                      {saveMessage && (
                        <p className={`text-sm ${saveMessage.startsWith('儲存成功') ? 'text-emerald-400' : 'text-red-400'}`}>
                          {saveMessage}
                        </p>
                      )}
                      <button
                          type="button"
                          onClick={handleSave}
                          disabled={isSaving}
                          className="bg-primary text-black px-6 py-2 rounded-lg font-bold hover:bg-yellow-500 flex items-center gap-2 disabled:opacity-60 sm:ml-auto"
                      >
                          <Save size={18} /> {isSaving ? '儲存中…' : '儲存變更'}
                      </button>
                    </div>
                </div>
            ) : (
                <div className="bg-card/50 p-6 md:p-10 rounded-2xl border border-white/5 shadow-lg">
                    <div className="prose prose-invert max-w-none">
                        {!isConfigured && !content.trim() ? (
                          <p className="text-gray-400 text-lg leading-loose font-light">
                            {getAftercareEmptyMessage(brand)}
                          </p>
                        ) : (
                          <p className="whitespace-pre-wrap text-gray-300 text-lg leading-loose font-light">
                            {content}
                          </p>
                        )}
                    </div>
                </div>
            )}
          </>
      )}

      {!showAdminEditor && aftercareContactNote && (
        <div className="mt-12 text-center text-gray-400 text-sm space-y-3">
          <p>如有任何問題，歡迎隨時聯繫我們。</p>
          <LineEntryButton
            placement="aftercare"
            variant="pill"
            label="LINE 詢問・加入好友"
            className="h-10 px-4 text-sm"
          />
        </div>
      )}
    </div>
  );
};

export default Aftercare;
