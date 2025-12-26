import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Appointment, UserRole } from '../types';
import { useApp } from '../App';
import { CheckCircle, AlertTriangle, Download, Trash2, X, Edit3, Lock } from 'lucide-react';

// 同意書條款內容
const CONSENT_TERMS = [
  '紋身乃是在人體皮膚上用針直接雕刻(形成傷口)描繪圖樣，對人體有時會造成傷害，此外即使雕刻方法本身沒有問題，有時被紋身者因個人體質會產生身體不適之症狀，若紋身過程立書人因皮膚疼痛，且因疼痛而震動並導致圖樣變形，需由立書人自行負責。',
  '本店採用拋棄式針頭，接觸皮膚之周邊具皆經過高溫高壓消毒殺菌處理，紋身雕刻時使用之紋身機具、色料或各種藥物等紋身用品，會因個人的體質關係，皮膚可能會產生過敏之症狀。',
  '紋身後之圖樣，會因本人自身的日常維護細心與否，紋路色澤會有很大的影響，若後續的日常維護太粗糙會使：一、疤疤變厚、雕刻時之傷口一時之間難以癒合。二、傷口癒合之後，紋身墨、彩色料等脫落之情形也有可能發生，基於以上原因，本人必須於日常時仔細維護紋身圖樣。',
  '酒類、迷幻藥等違禁藥品之服用、睡眠不足或將傷口暴露於空氣之中有可能導致皮膚化膿班點或其他各種症狀發生，故一旦接受紋身之後，應避免前述行為。',
  '若孕婦、罹患皮膚病、傳染病、心臟病、肝病、糖尿病、愛滋病等具傳染疾病時，不可接受紋身。',
  '未滿18歲者需法定監護人陪同並簽名蓋章，視同放棄法律追訴權力，立書人同意提供任何可證明身份之文件以供確認，作為立書人承諾證明。(※民法通過自2023年1月1日起，滿18歲視同成年人。)',
  '紋身期間圖稿、手繪稿、完成作品著作權為店家所有，店家有權保存收藏原稿和照片並自行運用，該項放入網路及店家供人瀏覽欣賞，立書人不得有異議。',
  '立書人在了解以上說明之後，完全理解並認同之情況下才委託紋身工作室；因此萬一發生上述說明內容所列舉之任何不適症狀問題時，本人同意此紋身工作室不必負任何法律責任，且不會對此店家之紋身師提出任何異議及法律告訴。'
];

const ConsentForm: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { user } = useApp();
  
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  
  // 表單狀態
  const [signerName, setSignerName] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // 簽名相關
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  // 簽名繪圖狀態（用於原生事件監聽器）
  const isDrawingRef = useRef(false);
  
  // 當簽名視窗打開時，鎖定背景滾動（LINE 瀏覽器特殊處理）
  useEffect(() => {
    if (isSignatureModalOpen) {
      // 記錄當前滾動位置
      const scrollY = window.scrollY;
      
      // 添加 class 並鎖定 body
      document.body.classList.add('fullscreen-mode');
      document.body.style.top = `-${scrollY}px`;
      document.documentElement.style.overflow = 'hidden';
      
      // 在非 canvas 區域阻止 touchmove（防止 LINE 下拉關閉）
      const preventTouchMove = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        // 如果觸控目標是 canvas，不阻止（讓簽名可以正常運作）
        if (target.tagName === 'CANVAS') {
          // 只阻止預設行為，不阻止傳播
          e.preventDefault();
          return;
        }
        // 非 canvas 區域，完全阻止
        e.preventDefault();
      };
      
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      
      return () => {
        document.body.classList.remove('fullscreen-mode');
        document.body.style.top = '';
        document.documentElement.style.overflow = '';
        window.scrollTo(0, scrollY);
        document.removeEventListener('touchmove', preventTouchMove);
      };
    }
  }, [isSignatureModalOpen]);
  
  // 為 Canvas 設置原生事件監聽器（處理簽名繪圖）
  useEffect(() => {
    if (!isSignatureModalOpen) return;
    
    // 延遲一下確保 canvas 已經渲染
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const getPos = (e: TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY
        };
      };
      
      const getCtx = () => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
        return ctx;
      };
      
      const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const ctx = getCtx();
        if (!ctx) return;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        isDrawingRef.current = true;
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (!isDrawingRef.current) return;
        const ctx = getCtx();
        if (!ctx) return;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };
      
      const handleTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        isDrawingRef.current = false;
      };
      
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      
      // 儲存清理函數的引用
      (canvas as any)._cleanupHandlers = () => {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      };
    }, 100);
    
    return () => {
      clearTimeout(timer);
      const canvas = canvasRef.current;
      if (canvas && (canvas as any)._cleanupHandlers) {
        (canvas as any)._cleanupHandlers();
      }
    };
  }, [isSignatureModalOpen]);

  const loadAppointment = async () => {
    if (!appointmentId) {
      setError('無效的連結');
      setIsLoading(false);
      return;
    }
    
    try {
      const data = await db.getConsent(appointmentId);
      if (!data) {
        setError('找不到此預約資料');
      } else {
        // 權限檢查：只有管理員或該預約的用戶可以訪問
        const isAdmin = user?.role === UserRole.ADMIN;
        const isOwner = user?.id && data.userId === user.id;
        
        if (!isAdmin && !isOwner) {
          setAccessDenied(true);
          setIsLoading(false);
          return;
        }
        
        if (data.signedAt) {
          setIsSubmitted(true);
          setAppointment(data);
        } else {
          setAppointment(data);
          // 預填客戶姓名和電話
          if (data.customerName) setSignerName(data.customerName);
          if (data.phoneNumber) setSignerPhone(data.phoneNumber);
        }
      }
    } catch (e) {
      setError('載入失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  // === 簽名視窗功能 ===
  const openSignatureModal = () => {
    setIsSignatureModalOpen(true);
    // 延遲初始化 canvas，確保 DOM 已渲染
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }, 100);
  };

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    return ctx;
  };

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ctx = getCanvasContext();
    if (!ctx) return;
    
    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    e.stopPropagation();
    
    const ctx = getCanvasContext();
    if (!ctx) return;
    
    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 檢查是否有簽名（不是純白色）
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let hasDrawing = false;
    
    for (let i = 0; i < data.length; i += 4) {
      // 檢查是否有非白色像素
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
        hasDrawing = true;
        break;
      }
    }
    
    if (!hasDrawing) {
      alert('請先簽名');
      return;
    }
    
    setSignatureDataUrl(canvas.toDataURL('image/png'));
    setIsSignatureModalOpen(false);
  };

  // === 提交表單 ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signerName.trim()) {
      alert('請輸入姓名');
      return;
    }
    if (!signerPhone.trim()) {
      alert('請輸入手機號碼');
      return;
    }
    if (!agreedTerms) {
      alert('請勾選同意條款');
      return;
    }
    if (!signatureDataUrl) {
      alert('請點擊簽名');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const success = await db.saveConsent({
        id: appointmentId!,
        signerName: signerName.trim(),
        signerPhone: signerPhone.trim(),
        signatureData: signatureDataUrl
      });
      
      if (success) {
        setIsSubmitted(true);
        await loadAppointment();
      } else {
        alert('提交失敗，請稍後再試');
      }
    } catch (err) {
      alert('提交失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  // === 下載 PDF ===
  const handleDownloadPDF = () => {
    window.print();
  };

  // === 載入中 ===
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">載入中...</div>
      </div>
    );
  }

  // === 錯誤 ===
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-800 mb-2">無法載入</h1>
          <p className="text-gray-500">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 text-blue-600 hover:underline"
          >
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  // === 權限被拒絕 ===
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <Lock className="mx-auto text-gray-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-800 mb-2">無法存取</h1>
          <p className="text-gray-500">此同意書僅限預約本人或管理員檢視</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 text-blue-600 hover:underline"
          >
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  // === 已簽署完成 ===
  if (isSubmitted && appointment) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 print:bg-white print:py-0">
        <div className="max-w-2xl mx-auto">
          {/* 成功提示 - 列印時隱藏 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-center print:hidden">
            <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
            <h1 className="text-xl font-bold text-green-800 mb-2">同意書已簽署完成！</h1>
            <p className="text-green-600 text-sm">感謝您的配合，期待為您服務</p>
          </div>

          {/* 同意書內容 - 可列印 */}
          <div className="bg-white rounded-lg shadow-lg p-6 print:shadow-none print:p-0">
            <div className="text-center border-b pb-4 mb-4">
              <h1 className="text-2xl font-bold">紋身同意書</h1>
              <p className="text-sm text-gray-500">Tattoo Consent For Operation</p>
            </div>

            {/* 預約資訊 */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <span className="text-gray-500">預約日期：</span>
                <span className="font-bold text-gray-900">{appointment.date}</span>
              </div>
              <div>
                <span className="text-gray-500">時間：</span>
                <span className="font-bold text-gray-900">{appointment.timeSlot}</span>
              </div>
              <div>
                <span className="text-gray-500">圖樣：</span>
                <span className="font-bold text-gray-900">{appointment.artworkTitle || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">紋身部位：</span>
                <span className="font-bold text-gray-900">{appointment.tattooPosition || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">大小：</span>
                <span className="font-bold text-gray-900">{appointment.tattooSize || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">色彩：</span>
                <span className="font-bold text-gray-900">{appointment.tattooColor || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">總金額：</span>
                <span className="font-bold text-gray-900">NT$ {appointment.totalPrice?.toLocaleString() || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">已付訂金：</span>
                <span className="font-bold text-gray-900">NT$ {appointment.depositPaid?.toLocaleString() || '-'}</span>
              </div>
              {appointment.totalPrice && appointment.depositPaid && (
                <div className="col-span-2">
                  <span className="text-gray-500">餘額：</span>
                  <span className="font-bold text-red-600">NT$ {(appointment.totalPrice - appointment.depositPaid).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* 條款 */}
            <div className="mb-6">
              <h3 className="font-bold mb-2 text-sm">注意事項：</h3>
              <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
                {CONSENT_TERMS.map((term, i) => (
                  <li key={i} className="leading-relaxed">{term}</li>
                ))}
              </ol>
            </div>

            {/* 簽署資訊 */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-500">立書人姓名：</span>
                  <span className="font-bold text-gray-900">{appointment.signerName}</span>
                </div>
                <div>
                  <span className="text-gray-500">電話：</span>
                  <span className="font-bold text-gray-900">{appointment.signerPhone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">簽署時間：</span>
                  <span className="font-bold text-gray-900">{appointment.signedAt}</span>
                </div>
              </div>
              
              {/* 簽名圖片 */}
              {appointment.signatureData && (
                <div className="border rounded p-2">
                  <p className="text-xs text-gray-500 mb-1">簽名：</p>
                  <img 
                    src={appointment.signatureData} 
                    alt="簽名" 
                    className="max-h-24 mx-auto"
                  />
                </div>
              )}
            </div>

            {/* 下載按鈕 - 僅管理員可見，列印時隱藏 */}
            {user?.role === UserRole.ADMIN && (
              <div className="mt-6 text-center print:hidden">
                <button
                  onClick={handleDownloadPDF}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 mx-auto"
                >
                  <Download size={20} />
                  下載 / 列印 PDF
                </button>
                <p className="text-xs text-gray-400 mt-2">點擊後請選擇「另存為 PDF」或直接列印</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === 填寫表單 ===
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* 標題 */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 text-center">
            <h1 className="text-2xl font-bold mb-1">紋身同意書</h1>
            <p className="text-sm text-gray-300">Tattoo Consent For Operation</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {/* 預約資訊 */}
            {appointment && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                <h3 className="font-bold text-blue-800 mb-3">📋 預約資訊</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-600">預約日期：</span>
                    <span className="font-bold text-gray-900">{appointment.date}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">時間：</span>
                    <span className="font-bold text-gray-900">{appointment.timeSlot}</span>
                  </div>
                  {appointment.artworkTitle && (
                    <div className="col-span-2">
                      <span className="text-blue-600">圖樣：</span>
                      <span className="font-bold text-gray-900">{appointment.artworkTitle}</span>
                    </div>
                  )}
                  {appointment.artworkImage && (
                    <div className="col-span-2">
                      <img 
                        src={appointment.artworkImage} 
                        alt="預約圖案" 
                        className="w-32 h-32 object-cover rounded border"
                      />
                    </div>
                  )}
                  {appointment.tattooPosition && (
                    <div>
                      <span className="text-blue-600">紋身部位：</span>
                      <span className="font-bold text-gray-900">{appointment.tattooPosition}</span>
                    </div>
                  )}
                  {appointment.tattooSize && (
                    <div>
                      <span className="text-blue-600">大小：</span>
                      <span className="font-bold text-gray-900">{appointment.tattooSize}</span>
                    </div>
                  )}
                  {appointment.tattooColor && (
                    <div>
                      <span className="text-blue-600">色彩：</span>
                      <span className="font-bold text-gray-900">{appointment.tattooColor}</span>
                    </div>
                  )}
                  {appointment.totalPrice && (
                    <div>
                      <span className="text-blue-600">總金額：</span>
                      <span className="font-bold text-red-600">NT$ {appointment.totalPrice.toLocaleString()}</span>
                    </div>
                  )}
                  {appointment.depositPaid && (
                    <div>
                      <span className="text-blue-600">已付訂金：</span>
                      <span className="font-bold text-green-600">NT$ {appointment.depositPaid.toLocaleString()}</span>
                    </div>
                  )}
                  {appointment.totalPrice && appointment.depositPaid && (
                    <div className="col-span-2">
                      <span className="text-blue-600">餘額：</span>
                      <span className="font-bold text-orange-600">NT$ {(appointment.totalPrice - appointment.depositPaid).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 注意事項 */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-700 mb-3">⚠️ 注意事項</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                <ol className="text-sm text-gray-700 space-y-3 list-decimal list-inside">
                  {CONSENT_TERMS.map((term, i) => (
                    <li key={i} className="leading-relaxed">{term}</li>
                  ))}
                </ol>
              </div>
            </div>

            {/* 額外條款 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
              <p className="mb-2">※ 請注意若圖形複雜，一次無法完成，可分趟紋身，分趟給款(請另外跟刺青師討論)。</p>
              <p className="mb-2">※ 已付款之訂金無法退費，請確認之</p>
              <p className="mb-2">※ 刺青後三個月內有包含一次免費補色，若超過期間將需額外付費</p>
            </div>

            {/* 同意勾選 */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input 
                type="checkbox"
                checked={agreedTerms}
                onChange={e => setAgreedTerms(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                本人已詳細閱讀並了解上述所有條款，完全理解並同意遵守，願意委託此紋身工作室進行紋身服務。
              </span>
            </label>

            {/* 個人資料 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">立書人姓名 *</label>
                <input 
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="請輸入您的姓名"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 font-medium focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">手機號碼 *</label>
                <input 
                  type="tel"
                  value={signerPhone}
                  onChange={e => setSignerPhone(e.target.value)}
                  placeholder="例如: 0912345678"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 font-medium focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* 簽名區域 - 點擊打開彈窗 */}
            <div className="mb-6">
              <label className="text-sm font-bold text-gray-700 mb-2 block">✍️ 電子簽名 *</label>
              
              {signatureDataUrl ? (
                // 已有簽名
                <div className="border-2 border-green-300 rounded-lg bg-green-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-700 font-medium text-sm">✅ 已簽名</span>
                    <button 
                      type="button"
                      onClick={() => {
                        setSignatureDataUrl('');
                        openSignatureModal();
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Edit3 size={14} /> 重新簽名
                    </button>
                  </div>
                  <img 
                    src={signatureDataUrl} 
                    alt="您的簽名" 
                    className="max-h-20 mx-auto border rounded bg-white"
                  />
                </div>
              ) : (
                // 尚未簽名
                <button
                  type="button"
                  onClick={openSignatureModal}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <Edit3 className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-gray-600 font-medium">點擊這裡進行簽名</p>
                  <p className="text-gray-400 text-sm mt-1">將開啟全螢幕簽名板</p>
                </button>
              )}
            </div>

            {/* 提交按鈕 */}
            <button
              type="submit"
              disabled={isSubmitting || !agreedTerms || !signatureDataUrl}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
                isSubmitting || !agreedTerms || !signatureDataUrl
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isSubmitting ? '提交中...' : '確認簽署'}
            </button>
          </form>
        </div>
      </div>

      {/* === 簽名彈窗 (完全複製 TattooPreview.tsx 的結構) === */}
      {isSignatureModalOpen && (
        <div 
          className="fixed inset-0 bg-black z-50 flex flex-col fullscreen-overlay"
          style={{ 
            touchAction: 'none',
            overscrollBehavior: 'none',
          }}
        >
          {/* 頂部工具列 */}
          <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 px-4 py-3 flex items-center justify-between safe-area-top">
            <button
              onClick={() => setIsSignatureModalOpen(false)}
              className="text-white flex items-center gap-2 py-2 px-3 active:opacity-70"
            >
              <X size={24} />
              <span>取消</span>
            </button>
            <h2 className="text-white font-bold text-lg">請在下方簽名</h2>
            <button
              onClick={clearSignature}
              className="text-red-400 flex items-center gap-1 py-2 px-3 active:opacity-70"
            >
              <Trash2 size={20} />
              <span>清除</span>
            </button>
          </div>
          
          {/* 簽名區域 - 使用與 TattooPreview.tsx 相同的 fullscreen-canvas-area class */}
          <div 
            className="flex-1 flex items-center justify-center p-2 overflow-hidden fullscreen-canvas-area"
            style={{ touchAction: 'none' }}
          >
            <div className="w-full max-w-lg">
              <canvas
                ref={canvasRef}
                width={600}
                height={300}
                className="w-full bg-white rounded-lg shadow-2xl"
                style={{ touchAction: 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
              <p className="text-center text-gray-400 mt-3 text-sm">請用手指或滑鼠在白色區域簽名</p>
            </div>
          </div>
          
          {/* 底部確認按鈕 */}
          <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-t border-white/10 p-4 safe-area-bottom">
            <button
              onClick={confirmSignature}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg active:bg-green-800"
            >
              確認簽名
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsentForm;
