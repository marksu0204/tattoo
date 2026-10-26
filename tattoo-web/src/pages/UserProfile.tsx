
import React, { useEffect, useState } from 'react';
import { useApp } from '../App';
import { useBrand } from '../context/BrandContext';
import { db } from '../services/mockBackend';
import { Appointment, UserRole } from '../types';
import { User, Calendar, LogOut, CheckCircle, Clock, MessageCircle, ArrowLeft, WifiOff, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildProfileSeo } from '../utils/seoConfig';
import { buildLineInquiryUrl, shouldShowPublicBookingCalendar } from '../utils/brandContact';
import { lineService } from '../services/lineService';

const UserProfile: React.FC = () => {
  const { user, logout } = useApp();
  const { brand } = useBrand();
  usePageSeo(buildProfileSeo(brand));
  const navigate = useNavigate();
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
        loadAppointments();
    }
  }, [user]);

  const loadAppointments = async () => {
      if (!user) return;
      setIsLoading(true);
      setError('');
      try {
        const accessToken = lineService.getAccessToken();
        if (!accessToken) {
          setError('LINE登入狀態失效，請重新登入');
          return;
        }
        const data = await db.getUserAppointments(accessToken, user.id);
        setMyAppointments(data);
      } catch (e) {
        console.error("Failed to load user appointments", e);
        setError('無法載入預約資料，請檢查網路連線。');
      } finally {
        setIsLoading(false);
      }
  };

  const getLineUrl = (apt: Appointment) => {
      const info = apt.artworkTitle ? `預約圖案: ${apt.artworkTitle}` : '一般諮詢';
      const message = `你好！我想變更以下預約：\n\n📅 日期: ${apt.date}\n⏰ 時間: ${apt.timeSlot}\n📝 內容: ${info}\n\n請問有哪些時段可以調整？`;
      return buildLineInquiryUrl(message, brand);
  };

  const handleCopyMessage = (apt: Appointment) => {
      const info = apt.artworkTitle ? `預約圖案: ${apt.artworkTitle}` : '一般諮詢';
      const message = `你好！我想變更以下預約：\n\n📅 日期: ${apt.date}\n⏰ 時間: ${apt.timeSlot}\n📝 內容: ${info}\n\n請問有哪些時段可以調整？`;
      navigator.clipboard.writeText(message).catch(() => {});
  };

  const getStatusBadge = (status: string) => {
      if (status === 'BOOKED') {
          return <span className="text-green-400 bg-green-900/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1"><CheckCircle size={10}/> 已確認</span>;
      }
      if (status === 'SIGNED') {
          return <span className="text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1"><CheckCircle size={10}/> 簽屬完成</span>;
      }
      if (status === 'SIGNING') {
          return <span className="text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1"><FileText size={10}/> 簽屬中</span>;
      }
      if (status === 'WAITING_PAYMENT') {
          return <span className="text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1"><Clock size={10}/> 待付款</span>;
      }
      if (status === 'PENDING') {
          return <span className="text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1"><Clock size={10}/> 待審核</span>;
      }
      return null;
  };

  if (!user) return <div className="pt-20 text-center text-gray-500">請先登入</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={20} className="mr-2" /> 返回首頁
      </button>

      <div className="bg-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10 bg-dark/50">
              <h1 className="text-2xl font-bold text-white">會員個人檔案</h1>
          </div>
          
          <div className="p-6">
              {/* Profile Header */}
              <div className="flex items-center gap-4 mb-8">
                  {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-20 h-20 rounded-full border-2 border-primary" />
                  ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center"><User size={40} /></div>
                  )}
                  <div>
                      <p className="text-xl font-bold text-white">{user.name}</p>
                      <p className="text-sm text-gray-500">身份: {user.role === UserRole.ADMIN ? '管理員' : '會員'}</p>
                      {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
                  </div>
              </div>

              {/* Appointments Section */}
              <h3 className="text-primary font-bold mb-4 flex items-center gap-2 text-lg border-b border-gray-700 pb-2">
                  <Calendar size={20}/> 我的預約
              </h3>
              
              <div className="space-y-3 mb-8">
                  {isLoading ? (
                      <p className="text-gray-500">載入中...</p>
                  ) : error ? (
                      <div className="text-center py-8 bg-red-900/10 rounded-lg border border-red-900/30">
                          <WifiOff className="mx-auto text-red-400 mb-2" />
                          <p className="text-red-300 mb-2">{error}</p>
                          <button onClick={loadAppointments} className="text-white bg-red-900/50 px-4 py-2 rounded hover:bg-red-800 text-sm">重試</button>
                      </div>
                  ) : myAppointments.length === 0 ? (
                      <div className="text-center py-8 bg-white/5 rounded-lg border border-dashed border-gray-700">
                          <p className="text-gray-400 mb-2">目前沒有預約</p>
                          {shouldShowPublicBookingCalendar(brand) && (
                            <button onClick={() => navigate('/calendar')} className="text-primary text-sm hover:underline">前往預約行事曆</button>
                          )}
                      </div>
                  ) : (
                      myAppointments.map(apt => (
                          <div key={apt.id} className="bg-dark p-4 rounded-lg border border-gray-700">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                  <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-1">
                                          <p className="text-white font-bold text-lg">{apt.date}</p>
                                          <span className="text-gray-400">@ {apt.timeSlot}</span>
                                          {getStatusBadge(apt.status)}
                                      </div>
                                      
                                      {apt.artworkTitle ? (
                                          <div className="flex gap-3 mt-2 bg-black/20 p-2 rounded">
                                              {apt.artworkImage && (
                                                  <img src={apt.artworkImage} alt="" className="w-10 h-10 rounded object-cover" />
                                              )}
                                              <div>
                                                  <span className="text-xs text-gray-500 block">預約圖案</span>
                                                  <span className="text-sm text-gray-300 font-medium">{apt.artworkTitle}</span>
                                              </div>
                                          </div>
                                      ) : (
                                          <p className="text-sm text-gray-500 mt-1 italic">{apt.notes || '一般諮詢'}</p>
                                      )}
                                  </div>
                                  {getLineUrl(apt) && (
                                  <a 
                                    href={getLineUrl(apt)!}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => handleCopyMessage(apt)}
                                    className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 border border-blue-900/30 px-3 py-1.5 rounded hover:bg-blue-900/10 transition-colors no-underline shrink-0"
                                  >
                                      <MessageCircle size={16} /> 變更預約
                                  </a>
                                  )}
                              </div>
                              
                              {/* 價格資訊區塊 - 只在有價格時顯示 */}
                              {(apt.totalPrice || apt.depositPaid) && (
                                  <div className="mt-3 pt-3 border-t border-gray-700/50">
                                      <div className="flex flex-wrap gap-4 text-sm">
                                          {apt.totalPrice && (
                                              <div className="bg-white/5 px-3 py-2 rounded-lg">
                                                  <span className="text-gray-400 block text-xs">總價</span>
                                                  <span className="text-white font-bold">NT$ {apt.totalPrice.toLocaleString()}</span>
                                              </div>
                                          )}
                                          {apt.depositPaid && (
                                              <div className="bg-green-900/20 px-3 py-2 rounded-lg border border-green-900/30">
                                                  <span className="text-green-400 block text-xs">已付訂金</span>
                                                  <span className="text-green-300 font-bold">NT$ {apt.depositPaid.toLocaleString()}</span>
                                              </div>
                                          )}
                                          {apt.totalPrice && apt.depositPaid && (
                                              <div className="bg-yellow-900/20 px-3 py-2 rounded-lg border border-yellow-900/30">
                                                  <span className="text-yellow-400 block text-xs">尾款</span>
                                                  <span className="text-yellow-300 font-bold">NT$ {(apt.totalPrice - apt.depositPaid).toLocaleString()}</span>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))
                  )}
              </div>
              
              <button 
                onClick={() => { logout(); navigate('/'); }} 
                className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                  <LogOut size={18} /> 登出
              </button>
          </div>
      </div>
    </div>
  );
};

export default UserProfile;
