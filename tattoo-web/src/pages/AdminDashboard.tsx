
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { generateArtworkDetails } from '../services/geminiService';
import { Artwork, ArtworkStatus, Appointment } from '../types'; 
import { Plus, Trash2, Edit, Sparkles, X, Settings, Heart, Calendar, CheckCircle, Clock, User, FileText, Save, Phone, Layers, Eye, ArrowUpDown, ArrowUp, ArrowDown, Copy, DollarSign, Users } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'artworks' | 'appointments' | 'customers'>('artworks');
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

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [specialPrice, setSpecialPrice] = useState(''); 
  const [imageUrl, setImageUrl] = useState(''); 
  const [pngUrl, setPngUrl] = useState(''); // 去背 PNG 檔案
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  
  // --- Deposit Confirmation Modal State ---
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [confirmingApt, setConfirmingApt] = useState<Appointment | null>(null);

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

  useEffect(() => {
    loadData();
    loadCategories();
  }, [activeTab]);

  const loadData = async () => {
    try {
        const [data, artworkStats, apts, users] = await Promise.all([
            db.getArtworks(),
            db.getArtworkStats(),
            db.getAppointments(),
            db.getAllUsers()
        ]);
        setArtworks(data); // Will be sorted by sortArtworks function
        setStats(artworkStats);
        
        // Filter appointments: show all non-OPEN or OPEN slots that have data (rare)
        const activeApts = apts
            .filter(a => a.status !== 'OPEN') 
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAppointments(activeApts);
        
        setCustomers(users);
    } catch (e: any) {
        console.error("Error loading admin data", e);
    }
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

  const loadCategories = async () => {
    try {
        const cats = await db.getCategories();
        setCategories(cats);
        if (!category && cats.length > 0) {
            const defaultCat = cats.find(c => c !== 'All') || cats[0];
            setCategory(defaultCat);
        }
    } catch (e) {
        console.error("Error loading categories", e);
    }
  };

  // --- Artwork Handlers ---

  const handleEditArtwork = (art: Artwork) => {
    setEditingId(art.id);
    setTitle(art.title);
    setCategory(art.category);
    setPrice(art.price ? art.price.toString() : '');
    setSpecialPrice(art.specialPrice ? art.specialPrice.toString() : '');
    setImageUrl(art.imageUrl);
    setPngUrl(art.pngUrl || '');
    setDescription(art.description);
    setTags(art.tags);
    setIsFormOpen(true);
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

  // PNG 壓縮函數 - 保留透明度
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
      
      // 🔒 驗證檔案
      const validation = validateImageFile(file, ALLOWED_IMAGE_TYPES);
      if (!validation.valid) {
        alert(`⚠️ 上傳失敗：${validation.error}`);
        e.target.value = ''; // 清除選擇
        return;
      }
      
      try {
        // 壓縮圖片後再設定
        const compressed = await compressImage(file, 1200, 0.8);
        setImageUrl(compressed);
      } catch (error) {
        console.error('Image compression failed:', error);
        alert('⚠️ 圖片處理失敗，請確認是有效的圖片檔案。');
        e.target.value = '';
      }
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
        // 壓縮 PNG 並保留透明度
        const compressed = await compressPng(file, 800);
        setPngUrl(compressed);
      } catch (error) {
        console.error('PNG compression failed:', error);
        alert('⚠️ PNG 處理失敗，請確認是有效的 PNG 圖片。');
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

  const handleSubmitArtwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !imageUrl) return;

    const newArtwork: Artwork = {
      id: editingId || Date.now().toString(),
      title,
      description: description || 'No description provided.',
      imageUrl: imageUrl,
      pngUrl: pngUrl || undefined, // 去背 PNG 檔案
      category,
      price: price ? Number(price) : undefined,
      specialPrice: specialPrice ? Number(specialPrice) : undefined,
      status: editingId ? artworks.find(a => a.id === editingId)?.status || ArtworkStatus.AVAILABLE : ArtworkStatus.AVAILABLE,
      createdAt: editingId ? (artworks.find(a => a.id === editingId)?.createdAt || getMysqlDateTime()) : getMysqlDateTime(),
      tags: tags
    };

    try {
        await db.saveArtwork(newArtwork);
        setIsFormOpen(false);
        setEditingId(null);
        resetArtworkForm();
        loadData();
    } catch (error: any) {
        console.error(error);
        alert(`無法儲存作品。\n\n錯誤: ${error.message}`);
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
    setTitle('');
    setDescription('');
    setPrice('');
    setSpecialPrice('');
    setTags([]);
    setImageUrl('');
    setPngUrl('');
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

  // 確認訂金（填寫訂金金額後）
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

  // 確認已收到訂金
  const confirmReceivedDeposit = async (apt: Appointment) => {
      if (window.confirm(`確認已收到 ${apt.customerName} 的訂金？`)) {
          try {
              const updatedApt: Appointment = {
                  ...apt,
                  status: 'SIGNING'
              };
              await db.saveAppointment(updatedApt);
              loadData();
          } catch (error: any) {
              alert(`確認失敗: ${error.message}`);
          }
      }
  };

  // 複製同意書訊息
  const copyConsentMessage = (apt: Appointment) => {
      const consentLink = `${window.location.origin}/#/consent/${apt.id}`;
      const message = `您好，已經收到您的訂金，下列為此次刺青的同意書，

請您確認內容沒問題並且線上簽名並送出即可，感謝!

${consentLink}`;
      
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
            loadData();
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
  const copyConsentLink = (aptId: string) => {
      // 使用當前網址自動生成連結（支援新網址 https://inkflow.work/）
      // HashRouter 使用 # 作為路由前綴
      const link = `${window.location.origin}/#/consent/${aptId}`;
      navigator.clipboard.writeText(link);
      alert('同意書連結已複製！');
  };

  // 複製訂單查看連結
  const copyAppointmentLink = (aptId: string) => {
      const link = `${window.location.origin}/#/appointment/${aptId}`;
      navigator.clipboard.writeText(link);
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">管理後台</h1>
        
        {activeTab === 'artworks' && (
            <div className="flex gap-2">
                <button 
                onClick={() => setIsCatManagerOpen(true)}
                className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg font-bold flex items-center hover:bg-gray-700 transition-colors"
                >
                <Settings size={20} className="mr-2" /> 管理分類
                </button>
                <button 
                onClick={() => { resetArtworkForm(); setIsFormOpen(true); }}
                className="bg-primary text-black px-4 py-2 rounded-lg font-bold flex items-center hover:bg-yellow-500 transition-colors"
                >
                <Plus size={20} className="mr-2" /> 新增作品
                </button>
            </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 mb-6">
        <button 
          onClick={() => setActiveTab('artworks')}
          className={`pb-2 px-4 ${activeTab === 'artworks' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          作品管理
        </button>
        <button 
           onClick={() => setActiveTab('appointments')}
           className={`pb-2 px-4 ${activeTab === 'appointments' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          預約管理 ({appointments.filter(a => a.status === 'PENDING').length} 待審核)
        </button>
        <button 
           onClick={() => setActiveTab('customers')}
           className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'customers' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          <Users size={16} />
          顧客名單 ({customers.length})
        </button>
      </div>

      {/* --- Artwork List --- */}
      {activeTab === 'artworks' && (
        <div>
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
              共 {artworks.length} 件作品
            </span>
          </div>

          <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-dark text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-6 py-4">縮圖</th>
                  <th className="px-6 py-4">資訊</th>
                  <th className="px-6 py-4">價格</th>
                  <th className="px-6 py-4">瀏覽</th>
                  <th className="px-6 py-4">狀態</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sortedArtworks.map(art => (
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
                        {art.pngUrl && (
                          <span className="text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Layers size={10} /> PNG
                          </span>
                        )}
                      </div>
                    </button>
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
                      className={`px-3 py-1 rounded-full text-xs font-bold ${art.status === ArtworkStatus.AVAILABLE ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}
                    >
                      {art.status === ArtworkStatus.AVAILABLE ? '未認領' : '已認領'}
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
              ))}
              </tbody>
            </table>
          </div>
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

          <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
             {appointments.length === 0 ? (
                 <div className="text-center py-20 text-gray-500">
                     目前沒有預約資料。
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
                    {appointments.map(apt => (
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
                                {apt.status === 'PENDING' && (
                                    <span className="bg-yellow-900/30 text-yellow-400 border border-yellow-900/50 px-2 py-1 rounded text-xs font-bold flex items-center w-fit gap-1">
                                        <Clock size={12}/> 待審核
                                    </span>
                                )}
                                {apt.status === 'WAITING_PAYMENT' && (
                                    <span className="bg-orange-900/30 text-orange-400 border border-orange-900/50 px-2 py-1 rounded text-xs font-bold flex items-center w-fit gap-1">
                                        <DollarSign size={12}/> 待付款
                                    </span>
                                )}
                                {apt.status === 'SIGNING' && (
                                    <span className="bg-blue-900/30 text-blue-400 border border-blue-900/50 px-2 py-1 rounded text-xs font-bold flex items-center w-fit gap-1">
                                        <FileText size={12}/> 簽屬中
                                    </span>
                                )}
                                {apt.status === 'SIGNED' && (
                                    <span className="bg-purple-900/30 text-purple-400 border border-purple-900/50 px-2 py-1 rounded text-xs font-bold flex items-center w-fit gap-1">
                                        <CheckCircle size={12}/> 簽屬完成
                                    </span>
                                )}
                                {apt.status === 'BOOKED' && (
                                    <span className="bg-green-900/30 text-green-400 border border-green-900/50 px-2 py-1 rounded text-xs font-bold flex items-center w-fit gap-1">
                                        <CheckCircle size={12}/> 已確認
                                    </span>
                                )}
                                {apt.status === 'COMPLETED' && (
                                    <span className="bg-gray-700 text-gray-400 px-2 py-1 rounded text-xs font-bold">已完成</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex flex-wrap gap-1 justify-end">
                                    {/* 認領圖：待審核 → 確認訂金 */}
                                    {apt.status === 'PENDING' && apt.orderType !== 'CUSTOM' && (
                                        <button 
                                            onClick={() => openDepositModal(apt)}
                                            className="bg-primary text-black text-xs font-bold px-3 py-1.5 rounded hover:bg-yellow-500 transition-colors"
                                        >
                                            確認訂金
                                        </button>
                                    )}
                                    
                                    {/* 待付款：複製訂金訊息 + 已收到訂金 */}
                                    {apt.status === 'WAITING_PAYMENT' && (
                                        <>
                                            <button 
                                                onClick={() => copyDepositMessage(apt)}
                                                className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-blue-500 transition-colors flex items-center gap-1"
                                            >
                                                <Copy size={12}/> 複製訂金訊息
                                            </button>
                                            <button 
                                                onClick={() => confirmReceivedDeposit(apt)}
                                                className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-green-500 transition-colors"
                                            >
                                                已收到訂金
                                            </button>
                                        </>
                                    )}
                                    
                                    {/* 客製圖：簽屬中狀態 - 如果沒有圖片，顯示上傳按鈕 */}
                                    {apt.status === 'SIGNING' && apt.orderType === 'CUSTOM' && !apt.artworkImage && (
                                        <button 
                                            onClick={() => openCustomImageUpload(apt)}
                                            className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-purple-500 transition-colors flex items-center gap-1"
                                        >
                                            <Plus size={12}/> 上傳客製圖片
                                        </button>
                                    )}
                                    
                                    {/* 客製圖：簽屬中狀態 - 如果有圖片，顯示複製同意書訊息 */}
                                    {apt.status === 'SIGNING' && (apt.orderType !== 'CUSTOM' || apt.artworkImage) && (
                                        <button 
                                            onClick={() => copyConsentMessage(apt)}
                                            className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-blue-500 transition-colors flex items-center gap-1"
                                        >
                                            <Copy size={12}/> 複製同意書訊息
                                        </button>
                                    )}
                                    
                                    {/* 客製圖：簽屬中狀態 - 有圖片時也可以更換圖片 */}
                                    {apt.status === 'SIGNING' && apt.orderType === 'CUSTOM' && apt.artworkImage && (
                                        <button 
                                            onClick={() => openCustomImageUpload(apt)}
                                            className="bg-gray-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-gray-500 transition-colors flex items-center gap-1"
                                        >
                                            <Edit size={12}/> 更換圖片
                                        </button>
                                    )}
                                    
                                    {/* 簽屬完成：查看簽署書 */}
                                    {apt.status === 'SIGNED' && (
                                        <button 
                                            onClick={() => navigate(`/consent/${apt.id}`)}
                                            className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-purple-500 transition-colors"
                                        >
                                            查看簽署書
                                        </button>
                                    )}
                                    
                                    {/* 通用按鈕 */}
                                    <button
                                        onClick={() => copyAppointmentLink(apt.id)}
                                        className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-indigo-500 transition-colors flex items-center gap-1"
                                        title="複製訂單查看連結給客人"
                                    >
                                        <Copy size={12}/> 訂單連結
                                    </button>
                                    <button
                                        onClick={() => handleEditAppointment(apt)}
                                        className="bg-gray-700 hover:bg-white hover:text-black text-gray-300 text-xs font-bold px-3 py-1.5 rounded transition-colors"
                                    >
                                        <Edit size={14}/>
                                    </button>
                                    <button 
                                        onClick={() => cancelAppointment(apt.id)}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-1.5 rounded text-xs font-bold border border-red-900/30"
                                    >
                                        取消
                                    </button>
                                </div>
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
        <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
          {customers.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              目前沒有顧客資料。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-dark text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4">顧客資訊</th>
                    <th className="px-6 py-4">加入日期</th>
                    <th className="px-6 py-4">最後登入</th>
                    <th className="px-6 py-4">收藏數量</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {customers.map((customer) => (
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
                          <span className="text-white font-bold text-lg">
                            {customer.favoriteCount || 0}
                          </span>
                          <span className="text-gray-400 text-sm">件作品</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- Upload Modal --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{editingId ? '編輯作品' : '上傳新作品'}</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white"><X /></button>
            </div>
            
            <form onSubmit={handleSubmitArtwork} className="p-6 space-y-6">
              
              {/* Image Input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 主圖片上傳 */}
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    required={!imageUrl}
                  />
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="mx-auto h-40 object-contain" />
                  ) : (
                    <div className="text-gray-500">
                      <p className="font-medium">主圖片</p>
                      <p className="text-xs mt-1">點擊上傳作品圖片</p>
                    </div>
                  )}
                </div>

                {/* PNG 去背檔案上傳 */}
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-green-500 transition-colors cursor-pointer relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzJhMmEyYSIvPgo8cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzJhMmEyYSIvPgo8L3N2Zz4=')]">
                  <input 
                    type="file" 
                    accept="image/png"
                    onChange={handlePngChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {pngUrl ? (
                    <div className="relative">
                      <img src={pngUrl} alt="PNG Preview" className="mx-auto h-40 object-contain" />
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPngUrl(''); }}
                        className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-full hover:bg-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <Layers className="mx-auto mb-2 text-green-500" size={24} />
                      <p className="font-medium text-green-400">PNG 去背檔 (選填)</p>
                      <p className="text-xs mt-1">用於刺青預覽功能</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm text-gray-400 mb-1">分類</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white"
                  >
                    {categories.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
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

              <button 
                type="submit" 
                className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-500"
              >
                儲存作品
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

      {/* --- Deposit Confirmation Modal --- */}
      {isDepositModalOpen && confirmingApt && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-white/10">
                  <div className="p-5 border-b border-white/10 flex justify-between items-center bg-dark/50">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <DollarSign size={18} className="text-primary"/> 確認訂金
                      </h2>
                      <button onClick={() => { setIsDepositModalOpen(false); setConfirmingApt(null); setDepositAmount(''); }} className="text-gray-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-300 mb-2">
                              顧客：{confirmingApt.customerName}
                          </label>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                              訂金金額 (NT$)
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
                              確認
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- Category Manager Modal (Simplified) --- */}
      {isCatManagerOpen && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-sm rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4">管理分類</h3>
                  <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      {categories.map(cat => (
                          <li key={cat} className="flex justify-between items-center text-sm bg-white/5 p-2 rounded">
                              {cat}
                              {cat !== 'All' && (
                                  <button onClick={() => handleDeleteCategory(cat)} className="text-red-400 hover:text-white"><X size={14}/></button>
                              )}
                          </li>
                      ))}
                  </ul>
                  <div className="flex gap-2">
                      <input 
                        className="flex-1 bg-dark border border-gray-700 rounded px-2 text-sm text-white" 
                        placeholder="新分類名稱"
                        value={newCategoryInput}
                        onChange={e => setNewCategoryInput(e.target.value)}
                      />
                      <button onClick={handleAddCategory} className="bg-primary text-black px-3 rounded font-bold text-sm">新增</button>
                  </div>
                  <button onClick={() => setIsCatManagerOpen(false)} className="w-full mt-4 text-gray-400 text-sm hover:text-white">關閉</button>
              </div>
          </div>
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
    </div>
  );
};

export default AdminDashboard;
