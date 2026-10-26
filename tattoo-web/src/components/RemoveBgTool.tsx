import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, RefreshCw, Sliders, Image as ImageIcon, Save, X, Share2 } from 'lucide-react';
import { db } from '../services/mockBackend';
import {
  type GrayscaleStepSize,
  type GrayscaleTransparencyMode,
  type InkAlphaRemoveBgOptions,
  type RemoveBgMode,
  detectColorArtwork,
  processRemoveBackground,
} from '../utils/removeBackground';
import { canShareImageFile, canvasToBlob, downloadBlobFile, isTouchMobileDevice } from '../utils/imageDownload';
import {
  REMOVE_BG_PRESET_SETTING_KEY,
  SYSTEM_DEFAULT_REMOVE_BG_PRESET,
  normalizeRemoveBgPreset,
  type RemoveBgPreset,
} from '../utils/removeBackgroundPreset';

const CHECKERBOARD = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='10' height='10' fill='%23ccc'/%3E%3Crect x='10' y='10' width='10' height='10' fill='%23ccc'/%3E%3Crect x='10' width='10' height='10' fill='%23fff'/%3E%3Crect y='10' width='10' height='10' fill='%23fff'/%3E%3C/svg%3E")`;

type PreviewBackground = 'checker' | 'white' | 'black' | 'skin';

const PREVIEW_BACKGROUND_OPTIONS: Array<{ value: PreviewBackground; label: string }> = [
  { value: 'checker', label: '透明格' },
  { value: 'white', label: '白底' },
  { value: 'black', label: '黑底' },
  { value: 'skin', label: '膚色' },
];

const getPreviewBackgroundStyle = (background: PreviewBackground): React.CSSProperties => {
  if (background === 'checker') return { background: CHECKERBOARD };
  if (background === 'white') return { backgroundColor: '#ffffff' };
  if (background === 'black') return { backgroundColor: '#0a0a0a' };
  return { backgroundColor: '#d4a574' };
};

const MODE_OPTIONS: Array<{ value: RemoveBgMode; label: string }> = [
  { value: 'ink_alpha', label: '純黑墨色（推薦）' },
  { value: 'standard', label: '標準去背' },
  { value: 'grayscale_alpha', label: '灰階透明去背' },
];

const STEP_OPTIONS: Array<{ value: GrayscaleStepSize; label: string }> = [
  { value: 0.05, label: '5%' },
  { value: 0.1, label: '10%' },
  { value: 0.2, label: '20%' },
];

const applyPresetToState = (
  preset: RemoveBgPreset,
  setters: {
    setMode: (v: RemoveBgMode) => void;
    setThreshold: (v: number) => void;
    setFeather: (v: number) => void;
    setWhitePoint: (v: number) => void;
    setBlackStrength: (v: number) => void;
    setOpacityGain: (v: number) => void;
    setTransparencyMode: (v: GrayscaleTransparencyMode) => void;
    setStepSize: (v: GrayscaleStepSize) => void;
    setInk: (v: InkAlphaRemoveBgOptions) => void;
    setAutoColorFallback: (v: boolean) => void;
  }
) => {
  setters.setMode(preset.mode);
  setters.setThreshold(preset.standard.threshold);
  setters.setFeather(preset.standard.feather);
  setters.setWhitePoint(preset.grayscale.whitePoint);
  setters.setBlackStrength(preset.grayscale.blackStrength);
  setters.setOpacityGain(preset.grayscale.opacityGain);
  setters.setTransparencyMode(preset.grayscale.transparencyMode);
  setters.setStepSize(preset.grayscale.stepSize);
  setters.setInk({ ...preset.ink });
  setters.setAutoColorFallback(preset.autoColorFallback);
};

const RemoveBgTool: React.FC = () => {
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultInfo, setResultInfo] = useState('');
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetSavedAt, setPresetSavedAt] = useState<string | null>(null);

  const [mode, setMode] = useState<RemoveBgMode>(SYSTEM_DEFAULT_REMOVE_BG_PRESET.mode);
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>('checker');

  const [threshold, setThreshold] = useState(SYSTEM_DEFAULT_REMOVE_BG_PRESET.standard.threshold);
  const [feather, setFeather] = useState(SYSTEM_DEFAULT_REMOVE_BG_PRESET.standard.feather);

  const [whitePoint, setWhitePoint] = useState(SYSTEM_DEFAULT_REMOVE_BG_PRESET.grayscale.whitePoint);
  const [blackStrength, setBlackStrength] = useState(SYSTEM_DEFAULT_REMOVE_BG_PRESET.grayscale.blackStrength);
  const [opacityGain, setOpacityGain] = useState(SYSTEM_DEFAULT_REMOVE_BG_PRESET.grayscale.opacityGain);
  const [transparencyMode, setTransparencyMode] = useState<GrayscaleTransparencyMode>(
    SYSTEM_DEFAULT_REMOVE_BG_PRESET.grayscale.transparencyMode
  );
  const [stepSize, setStepSize] = useState<GrayscaleStepSize>(SYSTEM_DEFAULT_REMOVE_BG_PRESET.grayscale.stepSize);

  const [ink, setInk] = useState<InkAlphaRemoveBgOptions>({ ...SYSTEM_DEFAULT_REMOVE_BG_PRESET.ink });
  const [autoColorFallback, setAutoColorFallback] = useState(SYSTEM_DEFAULT_REMOVE_BG_PRESET.autoColorFallback);
  const [colorDetected, setColorDetected] = useState(false);
  const updateInk = (patch: Partial<InkAlphaRemoveBgOptions>) => setInk((prev) => ({ ...prev, ...patch }));

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPreset = async () => {
      try {
        const { value, updatedAt } = await db.getAdminSetting<RemoveBgPreset>(REMOVE_BG_PRESET_SETTING_KEY);
        const normalized = normalizeRemoveBgPreset(value);
        if (cancelled || !normalized) return;
        applyPresetToState(normalized, {
          setMode,
          setThreshold,
          setFeather,
          setWhitePoint,
          setBlackStrength,
          setOpacityGain,
          setTransparencyMode,
          setStepSize,
          setInk,
          setAutoColorFallback,
        });
        setPresetSavedAt(updatedAt ?? normalized.savedAt ?? null);
      } catch (err) {
        console.error('Failed to load remove bg preset', err);
      }
    };
    loadPreset();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loadedImage || !originalCanvasRef.current) return;
    const canvas = originalCanvasRef.current;
    canvas.width = loadedImage.width;
    canvas.height = loadedImage.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(loadedImage, 0, 0);
    try {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setColorDetected(detectColorArtwork(data).isColor);
    } catch {
      setColorDetected(false);
    }
  }, [loadedImage]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setLoadedImage(img);
        setResultInfo('');
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const buildCurrentPreset = useCallback((): RemoveBgPreset => ({
    mode,
    standard: { threshold, feather },
    grayscale: { whitePoint, blackStrength, opacityGain, transparencyMode, stepSize },
    ink: { ...ink },
    autoColorFallback,
    savedAt: new Date().toISOString(),
  }), [mode, threshold, feather, whitePoint, blackStrength, opacityGain, transparencyMode, stepSize, ink, autoColorFallback]);

  const handleSaveArtworkPreset = async () => {
    setPresetSaving(true);
    try {
      const preset = buildCurrentPreset();
      await db.saveAdminSetting(REMOVE_BG_PRESET_SETTING_KEY, preset);
      setPresetSavedAt(preset.savedAt ?? null);
      alert('已儲存為新增作品預設');
    } catch (err) {
      console.error(err);
      alert('儲存預設失敗，請稍後再試。');
    } finally {
      setPresetSaving(false);
    }
  };

  const processImage = useCallback(() => {
    if (!loadedImage || !outputCanvasRef.current) return;
    setProcessing(true);

    requestAnimationFrame(() => setTimeout(() => {
      try {
        const canvas = outputCanvasRef.current!;
        const width = loadedImage.width;
        const height = loadedImage.height;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(loadedImage, 0, 0);

        const imageData = ctx.getImageData(0, 0, width, height);
        const result = processRemoveBackground(
          imageData,
          mode,
          { threshold, feather },
          { whitePoint, blackStrength, opacityGain, transparencyMode, stepSize },
          ink
        );

        ctx.putImageData(imageData, 0, 0);
        const whitePointInfo =
          'whitePointUsed' in result && typeof result.whitePointUsed === 'number'
            ? ` | 紙張白點 ${result.whitePointUsed}`
            : '';
        setResultInfo(
          `${result.width}×${result.height}px | ${result.elapsedMs.toFixed(0)}ms | ${result.transparentPercent.toFixed(1)}% 已去背${whitePointInfo}`
        );
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : '未知錯誤';
        setResultInfo(`處理失敗: ${message}`);
      } finally {
        setProcessing(false);
      }
    }, 30));
  }, [loadedImage, mode, threshold, feather, whitePoint, blackStrength, opacityGain, transparencyMode, stepSize, ink]);

  useEffect(() => {
    if (!loadedImage) return;
    const timer = setTimeout(processImage, 200);
    return () => clearTimeout(timer);
  }, [processImage, loadedImage]);

  // 行動裝置（含 iPad、LINE 內建瀏覽器）不支援大圖直接下載：改為顯示圖片，可長按儲存、分享到相簿或下載檔案
  const [mobileDownload, setMobileDownload] = useState<{ dataUrl: string; file: File } | null>(null);

  const downloadPng = async () => {
    const canvas = outputCanvasRef.current;
    if (!canvas || !canvas.width) return;
    const fileName = `removebg_${mode}_${Date.now()}.png`;
    try {
      const blob = await canvasToBlob(canvas);
      if (!isTouchMobileDevice()) {
        downloadBlobFile(blob, fileName);
        return;
      }
      const file = new File([blob], fileName, { type: 'image/png' });
      // 長按儲存在 data: URL 圖片上最穩定（iOS Safari／LINE 內建瀏覽器）
      setMobileDownload({ dataUrl: canvas.toDataURL('image/png'), file });
    } catch (err) {
      console.error(err);
      alert('PNG 產生失敗，請再試一次。');
    }
  };

  const canShareMobileFile = Boolean(mobileDownload && canShareImageFile(mobileDownload.file));

  const shareMobileFile = async () => {
    if (!mobileDownload) return;
    try {
      await navigator.share({ files: [mobileDownload.file] });
    } catch (err) {
      // 使用者取消分享不需提示
      if (err instanceof Error && err.name !== 'AbortError') {
        alert('此瀏覽器無法直接分享，請長按圖片儲存。');
      }
    }
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border border-white/10 bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-white font-medium">新增作品去背預設</p>
          <p className="text-xs text-gray-500 mt-1">
            {presetSavedAt
              ? `已儲存預設 · ${new Date(presetSavedAt).toLocaleString('zh-TW')}`
              : '尚未儲存預設，新增作品時將使用系統預設參數'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveArtworkPreset}
          disabled={presetSaving}
          className="shrink-0 bg-primary text-black font-bold px-4 py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          <Save size={16} />
          {presetSaving ? '儲存中...' : '儲存為新增作品預設'}
        </button>
      </div>

      {!loadedImage ? (
        <div
          className="border-2 border-dashed border-gray-600 rounded-xl p-16 text-center cursor-pointer hover:border-gray-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto mb-4 text-gray-500" size={48} />
          <p className="text-gray-400 text-lg mb-2">拖放圖片到此處，或點擊上傳</p>
          <p className="text-gray-600 text-sm">支援白底圖、黑灰刺青圖、素描與點霧圖</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="flex gap-4 flex-col lg:flex-row">
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            <div className="bg-card rounded-xl border border-white/5 p-4 space-y-4">
              <h4 className="text-white font-semibold flex items-center gap-2">
                <Sliders size={16} /> 去背設定
              </h4>

              <div>
                <label className="text-xs text-gray-400 block mb-2">去背模式</label>
                <div className="grid grid-cols-1 gap-2">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        mode === option.value
                          ? 'bg-primary/15 border-primary text-primary'
                          : 'bg-dark border-white/10 text-gray-300 hover:border-white/20'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'ink_alpha' && (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    全部轉成純黑色，深淺只用透明度表現。合成到皮膚上不會泛白，效果最接近真實刺青。
                  </p>

                  {colorDetected && (
                    <p className="text-xs text-amber-300/90 leading-relaxed rounded-md border border-amber-300/30 bg-amber-300/5 px-2 py-1.5">
                      偵測到這張是彩色作品，純黑墨色會把顏色變成黑色。
                      {autoColorFallback ? '上架時會自動改用「標準去背」保留原色。' : '建議改用「標準去背」。'}
                    </p>
                  )}

                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ink.autoWhitePoint}
                      onChange={(e) => updateInk({ autoWhitePoint: e.target.checked })}
                      className="accent-primary"
                    />
                    自動偵測紙張顏色（建議開啟）
                  </label>

                  {!ink.autoWhitePoint && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        紙張白點: <span className="text-white font-semibold">{ink.whitePoint}</span>
                      </label>
                      <input
                        type="range"
                        min={150}
                        max={255}
                        value={ink.whitePoint}
                        onChange={(e) => updateInk({ whitePoint: +e.target.value })}
                        className="w-full accent-primary"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        比這個亮的視為紙張（完全透明）
                        <br />
                        紙張偏灰或偏黃時調低
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      黑點: <span className="text-white font-semibold">{ink.blackPoint}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={140}
                      value={ink.blackPoint}
                      onChange={(e) => updateInk({ blackPoint: +e.target.value })}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      比這個暗的視為 100% 純黑
                      <br />
                      越高 = 深色部分越實
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      雜訊清除: <span className="text-white font-semibold">{Math.round(ink.noiseFloor * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      value={Math.round(ink.noiseFloor * 100)}
                      onChange={(e) => updateInk({ noiseFloor: +e.target.value / 100 })}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      去除紙紋、髒點等極淡的痕跡
                      <br />
                      太高會吃掉淡墨暈染
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      墨色濃度: <span className="text-white font-semibold">{ink.inkStrength.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={2.5}
                      step={0.1}
                      value={ink.inkStrength}
                      onChange={(e) => updateInk({ inkStrength: +e.target.value })}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      1.0 = 忠實原圖
                      <br />
                      越高 = 淡墨更明顯；越低 = 淡墨更透
                    </p>
                  </div>

                  <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoColorFallback}
                      onChange={(e) => setAutoColorFallback(e.target.checked)}
                      className="accent-primary mt-0.5"
                    />
                    <span>
                      上架時偵測到彩色作品，自動改用標準去背保留原色
                    </span>
                  </label>
                </>
              )}

              {mode === 'standard' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      白色閾值: <span className="text-white font-semibold">{threshold}</span>
                    </label>
                    <input
                      type="range"
                      min={150}
                      max={255}
                      value={threshold}
                      onChange={(e) => setThreshold(+e.target.value)}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      越低 = 去除更多顏色（更積極）
                      <br />
                      越高 = 只去除接近純白的區域
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      邊緣柔化: <span className="text-white font-semibold">{feather}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={feather}
                      onChange={(e) => setFeather(+e.target.value)}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      0 = 硬邊（銳利切割）
                      <br />
                      越高 = 邊緣漸變越柔和
                    </p>
                  </div>
                </>
              )}

              {mode === 'grayscale_alpha' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      白色透明門檻: <span className="text-white font-semibold">{whitePoint}</span>
                    </label>
                    <input
                      type="range"
                      min={160}
                      max={255}
                      value={whitePoint}
                      onChange={(e) => setWhitePoint(+e.target.value)}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      越低＝去除更多淺色背景
                      <br />
                      越高＝保留更多淺灰細節
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      黑度強化: <span className="text-white font-semibold">{blackStrength.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min={0.2}
                      max={4}
                      step={0.1}
                      value={blackStrength}
                      onChange={(e) => setBlackStrength(+e.target.value)}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      越高 = 黑線更實、深灰更不透明
                      <br />
                      越低 = 保留較柔和灰階
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      不透明度增益: <span className="text-white font-semibold">{opacityGain.toFixed(1)}x</span>
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={3}
                      step={0.1}
                      value={opacityGain}
                      onChange={(e) => setOpacityGain(+e.target.value)}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      1.0x = 原始效果；1.5x～2.0x 適合偏淡素描稿
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-2">透明模式</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'linear' as const, label: '線性透明' },
                        { value: 'stepped' as const, label: '分級透明' },
                      ]).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTransparencyMode(option.value)}
                          className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                            transparencyMode === option.value
                              ? 'bg-primary/15 border-primary text-primary'
                              : 'bg-dark border-white/10 text-gray-300 hover:border-white/20'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {transparencyMode === 'stepped' && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">分級步距</label>
                      <div className="grid grid-cols-3 gap-2">
                        {STEP_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setStepSize(option.value)}
                            className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                              stepSize === option.value
                                ? 'bg-primary/15 border-primary text-primary'
                                : 'bg-dark border-white/10 text-gray-300 hover:border-white/20'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={processImage}
                disabled={processing}
                className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} className={processing ? 'animate-spin' : ''} />
                {processing ? '處理中...' : '重新處理'}
              </button>
              <button
                onClick={downloadPng}
                className="w-full bg-card border border-white/10 text-white py-2.5 rounded-lg hover:bg-white/5 flex items-center justify-center gap-2 text-sm"
              >
                <Download size={14} /> 下載去背 PNG
              </button>
              <button
                onClick={() => {
                  setLoadedImage(null);
                  setResultInfo('');
                }}
                className="w-full text-gray-500 py-2 text-sm hover:text-gray-300"
              >
                重新上傳圖片
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5 text-sm text-gray-400 flex items-center gap-2">
                <ImageIcon size={14} /> 原圖
              </div>
              <div className="p-2 flex items-center justify-center min-h-[200px] bg-black/30">
                <canvas ref={originalCanvasRef} className="max-w-full max-h-[60vh] object-contain" />
              </div>
            </div>
            <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5 text-sm text-gray-400 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-2">
                  <ImageIcon size={14} /> 去背結果
                </span>
                {resultInfo && <span className="text-xs text-gray-600">{resultInfo}</span>}
              </div>
              <div className="px-4 py-2 border-b border-white/5">
                <label className="text-xs text-gray-500 block mb-2">預覽背景</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PREVIEW_BACKGROUND_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPreviewBackground(option.value)}
                      className={`px-2 py-1.5 rounded-md text-[11px] border transition-colors ${
                        previewBackground === option.value
                          ? 'bg-primary/15 border-primary text-primary'
                          : 'bg-dark border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="p-2 flex items-center justify-center min-h-[200px]"
                style={getPreviewBackgroundStyle(previewBackground)}
              >
                <canvas ref={outputCanvasRef} className="max-w-full max-h-[60vh] object-contain" />
              </div>
            </div>
          </div>
        </div>
      )}

      {mobileDownload && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-white font-semibold text-sm">儲存去背 PNG</p>
            <button
              type="button"
              onClick={() => setMobileDownload(null)}
              className="p-2 text-gray-300 hover:text-white"
              aria-label="關閉"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            <img
              src={mobileDownload.dataUrl}
              alt="去背結果"
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ background: CHECKERBOARD, WebkitTouchCallout: 'default' }}
            />
          </div>
          <div
            className="px-4 pt-3 space-y-3 border-t border-white/10"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          >
            <p className="text-center text-sm text-gray-300">
              長按上方圖片 →「儲存到照片」或「下載影像」
            </p>
            {canShareMobileFile && (
              <button
                type="button"
                onClick={shareMobileFile}
                className="w-full bg-primary text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                <Share2 size={16} /> 分享／儲存到相簿
              </button>
            )}
            <button
              type="button"
              onClick={() => mobileDownload && downloadBlobFile(mobileDownload.file, mobileDownload.file.name)}
              className="w-full border border-white/20 text-gray-200 py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <Download size={16} /> 下載檔案（存到「檔案」App）
            </button>
            <p className="text-center text-xs text-gray-500">
              在 LINE 內開啟若無法儲存，請點右上角「⋯」改用 Safari／Chrome 開啟
            </p>
          </div>
        </div>
      )}

      {processing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-card rounded-xl p-8 text-center">
            <RefreshCw className="mx-auto mb-3 animate-spin text-primary" size={32} />
            <p className="text-white">處理中...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoveBgTool;
