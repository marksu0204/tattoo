import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, RefreshCw, Sliders, Image as ImageIcon } from 'lucide-react';

declare global {
  interface Window { cv: any; }
}

const LineartTool: React.FC = () => {
  const [cvReady, setCvReady] = useState(false);
  const [cvLoading, setCvLoading] = useState(true);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultInfo, setResultInfo] = useState('');

  // Method & params
  const [method, setMethod] = useState('tattoo');
  const [useCLAHE, setUseCLAHE] = useState(true);
  const [useBilateral, setUseBilateral] = useState(true);
  const [blurSize, setBlurSize] = useState(3);
  const [lineThickness, setLineThickness] = useState(1);
  const [removeNoise, setRemoveNoise] = useState(true);
  const [noiseThreshold, setNoiseThreshold] = useState(50);

  // Tattoo params
  const [tattooSensitivity, setTattooSensitivity] = useState(50);
  const [tattooTonal, setTattooTonal] = useState(15);
  const [tattooDetail, setTattooDetail] = useState(3);

  // XDoG params
  const [xdogSigma, setXdogSigma] = useState(0.4);
  const [xdogK, setXdogK] = useState(1.6);
  const [xdogP, setXdogP] = useState(25);
  const [xdogEps, setXdogEps] = useState(0.01);
  const [xdogPhi, setXdogPhi] = useState(200);

  // Canny params
  const [cannyT1, setCannyT1] = useState(30);
  const [cannyT2, setCannyT2] = useState(100);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load OpenCV.js
  useEffect(() => {
    if (window.cv && window.cv.Mat) {
      setCvReady(true);
      setCvLoading(false);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.9.0/opencv.js';
    script.async = true;
    script.onload = () => {
      // OpenCV.js may need a moment to initialize
      const check = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(check);
          setCvReady(true);
          setCvLoading(false);
        }
      }, 100);
      setTimeout(() => { clearInterval(check); setCvLoading(false); }, 15000);
    };
    script.onerror = () => setCvLoading(false);
    document.body.appendChild(script);

    return () => { /* keep script loaded */ };
  }, []);

  // Draw original image to canvas when loadedImage changes
  useEffect(() => {
    if (!loadedImage || !originalCanvasRef.current) return;
    const c = originalCanvasRef.current;
    c.width = loadedImage.width;
    c.height = loadedImage.height;
    c.getContext('2d')!.drawImage(loadedImage, 0, 0);
  }, [loadedImage]);

  // Handle file upload
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

  // Drop handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // Process image
  const processImage = useCallback(() => {
    if (!cvReady || !loadedImage || !outputCanvasRef.current) return;
    setProcessing(true);

    requestAnimationFrame(() => setTimeout(() => {
      try {
        const cv = window.cv;
        const t0 = performance.now();
        const MAX = 2000;

        // Prepare
        const tc = document.createElement('canvas');
        let w = loadedImage.width, h = loadedImage.height;
        if (Math.max(w, h) > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        tc.width = w; tc.height = h;
        tc.getContext('2d')!.drawImage(loadedImage, 0, 0, w, h);

        let src = cv.imread(tc);
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Preprocessing
        if (useCLAHE) {
          try {
            const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
            const enhanced = new cv.Mat();
            clahe.apply(gray, enhanced);
            gray.delete(); gray = enhanced;
            clahe.delete();
          } catch {
            const eq = new cv.Mat();
            cv.equalizeHist(gray, eq);
            gray.delete(); gray = eq;
          }
        }
        if (useBilateral) {
          const bf = new cv.Mat();
          cv.bilateralFilter(gray, bf, 9, 75, 75);
          gray.delete(); gray = bf;
        }
        if (blurSize > 1) {
          cv.GaussianBlur(gray, gray, new cv.Size(blurSize, blurSize), 0);
        }

        // Method
        let dst = new cv.Mat();
        switch (method) {
          case 'tattoo': doTattoo(cv, gray, dst); break;
          case 'xdog': doXDoG(cv, gray, dst); break;
          case 'canny': doCanny(cv, gray, dst); break;
          default: doCanny(cv, gray, dst);
        }

        // Noise removal
        if (removeNoise) {
          doRemoveNoise(cv, dst, noiseThreshold);
        }

        // Line thickness
        if (lineThickness > 0) {
          const inv = new cv.Mat();
          cv.bitwise_not(dst, inv);
          const kernel = cv.Mat.ones(lineThickness, lineThickness, cv.CV_8U);
          cv.dilate(inv, inv, kernel);
          cv.bitwise_not(inv, dst);
          kernel.delete(); inv.delete();
        }

        cv.imshow(outputCanvasRef.current!, dst);
        const elapsed = (performance.now() - t0).toFixed(0);
        const names: Record<string, string> = { tattoo: '刺青線稿', xdog: 'XDoG', canny: 'Canny' };
        setResultInfo(`${names[method] || method} | ${w}×${h}px | ${elapsed}ms`);

        src.delete(); gray.delete(); dst.delete();
      } catch (err: any) {
        console.error(err);
        setResultInfo('處理失敗: ' + err.message);
      } finally {
        setProcessing(false);
      }
    }, 30));
  }, [cvReady, loadedImage, method, useCLAHE, useBilateral, blurSize, lineThickness, removeNoise, noiseThreshold,
      tattooSensitivity, tattooTonal, tattooDetail, xdogSigma, xdogK, xdogP, xdogEps, xdogPhi, cannyT1, cannyT2]);

  // Auto-process on param change
  useEffect(() => {
    if (!loadedImage || !cvReady) return;
    const timer = setTimeout(processImage, 300);
    return () => clearTimeout(timer);
  }, [processImage]);

  // --- Processing methods ---
  function doTattoo(cv: any, gray: any, dst: any) {
    let cannyResult = cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1);
    for (let i = 0; i < tattooDetail; i++) {
      const scale = 1 + i * 0.5;
      const t1 = Math.round(tattooSensitivity * scale);
      const edges = new cv.Mat();
      cv.Canny(gray, edges, t1, Math.round(t1 * 2.5));
      cv.bitwise_or(cannyResult, edges, cannyResult);
      edges.delete();
    }
    const adaptiveResult = new cv.Mat();
    cv.adaptiveThreshold(gray, adaptiveResult, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, tattooTonal, 2);
    const adaptiveEdges = new cv.Mat();
    cv.bitwise_not(adaptiveResult, adaptiveEdges);
    const combined = new cv.Mat();
    cv.bitwise_or(cannyResult, adaptiveEdges, combined);
    const closeKernel = cv.Mat.ones(2, 2, cv.CV_8U);
    cv.morphologyEx(combined, combined, cv.MORPH_CLOSE, closeKernel);
    cv.bitwise_not(combined, dst);
    cannyResult.delete(); adaptiveResult.delete(); adaptiveEdges.delete(); combined.delete(); closeKernel.delete();
  }

  function doXDoG(cv: any, gray: any, dst: any) {
    const sigma2 = xdogSigma * xdogK;
    const ks1 = Math.max(3, Math.round(xdogSigma * 6) | 1);
    const ks2 = Math.max(3, Math.round(sigma2 * 6) | 1);
    const g1 = new cv.Mat(), g2 = new cv.Mat();
    cv.GaussianBlur(gray, g1, new cv.Size(ks1, ks1), xdogSigma);
    cv.GaussianBlur(gray, g2, new cv.Size(ks2, ks2), sigma2);
    const result = new cv.Mat(gray.rows, gray.cols, cv.CV_8UC1);
    const d1 = g1.data, d2 = g2.data, rd = result.data;
    for (let i = 0; i < d1.length; i++) {
      const v1 = d1[i] / 255, v2 = d2[i] / 255;
      const D = (1 + xdogP) * v1 - xdogP * v2;
      const T = D >= xdogEps ? 1.0 : 1.0 + Math.tanh(xdogPhi * (D - xdogEps));
      rd[i] = Math.max(0, Math.min(255, Math.round(T * 255)));
    }
    cv.threshold(result, dst, 128, 255, cv.THRESH_BINARY);
    g1.delete(); g2.delete(); result.delete();
  }

  function doCanny(cv: any, gray: any, dst: any) {
    cv.Canny(gray, dst, cannyT1, cannyT2);
    cv.bitwise_not(dst, dst);
  }

  function doRemoveNoise(cv: any, mat: any, minArea: number) {
    const inv = new cv.Mat();
    cv.bitwise_not(mat, inv);
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(inv, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
      if (cv.contourArea(contours.get(i)) < minArea) {
        cv.drawContours(inv, contours, i, new cv.Scalar(0), -1);
      }
    }
    cv.bitwise_not(inv, mat);
    inv.delete(); contours.delete(); hierarchy.delete();
  }

  // Download
  const downloadTransparent = () => {
    const c = outputCanvasRef.current;
    if (!c || !c.width) return;
    const ctx = c.getContext('2d')!;
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const brightness = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (brightness > 240) { px[i + 3] = 0; }
      else if (brightness > 180) {
        const alpha = Math.round(255 * (1 - (brightness - 180) / 60));
        px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = alpha;
      } else { px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = 255; }
    }
    const dl = document.createElement('canvas');
    dl.width = c.width; dl.height = c.height;
    dl.getContext('2d')!.putImageData(data, 0, 0);
    const a = document.createElement('a');
    a.download = `lineart_transparent_${Date.now()}.png`;
    a.href = dl.toDataURL('image/png'); a.click();
  };

  const downloadWhite = () => {
    const c = outputCanvasRef.current;
    if (!c || !c.width) return;
    const a = document.createElement('a');
    a.download = `lineart_white_${Date.now()}.png`;
    a.href = c.toDataURL('image/png'); a.click();
  };

  // --- Render ---
  return (
    <div>
      {/* Status */}
      {cvLoading && (
        <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-yellow-300 text-sm">
          OpenCV.js 載入中，請稍候...
        </div>
      )}
      {!cvLoading && !cvReady && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
          OpenCV.js 載入失敗，請重新整理頁面
        </div>
      )}

      {!loadedImage ? (
        /* Upload Area */
        <div
          className="border-2 border-dashed border-gray-600 rounded-xl p-16 text-center cursor-pointer hover:border-gray-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto mb-4 text-gray-500" size={48} />
          <p className="text-gray-400 text-lg mb-2">拖放圖片到此處，或點擊上傳</p>
          <p className="text-gray-600 text-sm">支援 JPG、PNG、WebP</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Controls */}
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            <div className="bg-card rounded-xl border border-white/5 p-4 space-y-4">
              <h4 className="text-white font-semibold flex items-center gap-2">
                <Sliders size={16} /> 處理設定
              </h4>

              {/* Method */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">提取方法</label>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="tattoo">刺青線稿（推薦）</option>
                  <option value="xdog">XDoG 藝術線稿</option>
                  <option value="canny">Canny 邊緣偵測</option>
                </select>
              </div>

              {/* Preprocessing */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">前處理</p>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={useCLAHE} onChange={e => setUseCLAHE(e.target.checked)} className="rounded" />
                  對比度增強
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={useBilateral} onChange={e => setUseBilateral(e.target.checked)} className="rounded" />
                  雙邊濾波降噪
                </label>
                <div>
                  <label className="text-xs text-gray-400">模糊: {blurSize}</label>
                  <input type="range" min={1} max={21} step={2} value={blurSize}
                    onChange={e => setBlurSize(+e.target.value)} className="w-full accent-primary" />
                </div>
              </div>

              {/* Method-specific params */}
              {method === 'tattoo' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">刺青線稿參數</p>
                  <div>
                    <label className="text-xs text-gray-400">邊緣靈敏度: {tattooSensitivity}</label>
                    <input type="range" min={10} max={150} value={tattooSensitivity}
                      onChange={e => setTattooSensitivity(+e.target.value)} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">色階偵測: {tattooTonal}</label>
                    <input type="range" min={3} max={51} step={2} value={tattooTonal}
                      onChange={e => setTattooTonal(+e.target.value)} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">細節層級: {tattooDetail}</label>
                    <input type="range" min={1} max={5} value={tattooDetail}
                      onChange={e => setTattooDetail(+e.target.value)} className="w-full accent-primary" />
                  </div>
                </div>
              )}

              {method === 'xdog' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">XDoG 參數</p>
                  <div>
                    <label className="text-xs text-gray-400">Sigma: {xdogSigma}</label>
                    <input type="range" min={0.2} max={3} step={0.1} value={xdogSigma}
                      onChange={e => setXdogSigma(+e.target.value)} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">銳利度: {xdogP}</label>
                    <input type="range" min={1} max={200} value={xdogP}
                      onChange={e => setXdogP(+e.target.value)} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">閾值: {xdogEps}</label>
                    <input type="range" min={-0.5} max={1} step={0.01} value={xdogEps}
                      onChange={e => setXdogEps(+e.target.value)} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">柔和度: {xdogPhi}</label>
                    <input type="range" min={1} max={1000} value={xdogPhi}
                      onChange={e => setXdogPhi(+e.target.value)} className="w-full accent-primary" />
                  </div>
                </div>
              )}

              {method === 'canny' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Canny 參數</p>
                  <div>
                    <label className="text-xs text-gray-400">閾值下限: {cannyT1}</label>
                    <input type="range" min={0} max={255} value={cannyT1}
                      onChange={e => setCannyT1(+e.target.value)} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">閾值上限: {cannyT2}</label>
                    <input type="range" min={0} max={255} value={cannyT2}
                      onChange={e => setCannyT2(+e.target.value)} className="w-full accent-primary" />
                  </div>
                </div>
              )}

              {/* Post-processing */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">後處理</p>
                <div>
                  <label className="text-xs text-gray-400">線條粗細: {lineThickness}px</label>
                  <input type="range" min={0} max={10} value={lineThickness}
                    onChange={e => setLineThickness(+e.target.value)} className="w-full accent-primary" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={removeNoise} onChange={e => setRemoveNoise(e.target.checked)} className="rounded" />
                  去除雜點
                </label>
                {removeNoise && (
                  <div>
                    <label className="text-xs text-gray-400">雜點面積閾值: {noiseThreshold}px</label>
                    <input type="range" min={10} max={500} value={noiseThreshold}
                      onChange={e => setNoiseThreshold(+e.target.value)} className="w-full accent-primary" />
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button onClick={processImage} disabled={!cvReady || processing}
                className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                <RefreshCw size={16} className={processing ? 'animate-spin' : ''} />
                {processing ? '處理中...' : '重新處理'}
              </button>
              <button onClick={downloadTransparent}
                className="w-full bg-card border border-white/10 text-white py-2.5 rounded-lg hover:bg-white/5 flex items-center justify-center gap-2 text-sm">
                <Download size={14} /> 下載去背 PNG
              </button>
              <button onClick={downloadWhite}
                className="w-full bg-card border border-white/10 text-gray-400 py-2.5 rounded-lg hover:bg-white/5 flex items-center justify-center gap-2 text-sm">
                <Download size={14} /> 下載白底 PNG
              </button>
              <button onClick={() => { setLoadedImage(null); setResultInfo(''); }}
                className="w-full text-gray-500 py-2 text-sm hover:text-gray-300">
                重新上傳圖片
              </button>
            </div>
          </div>

          {/* Preview */}
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
              <div className="px-4 py-2 border-b border-white/5 text-sm text-gray-400 flex items-center gap-2">
                <ImageIcon size={14} /> 線稿結果
                {resultInfo && <span className="ml-auto text-xs text-gray-600">{resultInfo}</span>}
              </div>
              <div className="p-2 flex items-center justify-center min-h-[200px] bg-white">
                <canvas ref={outputCanvasRef} className="max-w-full max-h-[60vh] object-contain" />
              </div>
            </div>
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

export default LineartTool;
