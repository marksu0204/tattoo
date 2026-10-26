import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { PublicAppointment } from '../types';
import { useBrand } from '../context/BrandContext';
import { ArrowLeft, Calendar, Clock, CheckCircle, FileText, DollarSign, MapPin, Palette, Ruler } from 'lucide-react';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildAppointmentSeo } from '../utils/seoConfig';
import { parsePublicAppointmentTokenFromHash, buildPublicConsentUrl } from '../utils/publicAppointmentToken';

const LEGACY_LINK_MESSAGE = '此訂單連結已更新，請向刺青師索取新的查看連結。';
const INVALID_TOKEN_MESSAGE = '此訂單連結無效或已失效，請聯繫刺青師重新取得連結。';

const AppointmentView: React.FC = () => {
  const { brand } = useBrand();
  usePageSeo(buildAppointmentSeo(brand));
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [appointment, setAppointment] = useState<PublicAppointment | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAppointment = useCallback(async () => {
    if (appointmentId) {
      setError(LEGACY_LINK_MESSAGE);
      setIsLoading(false);
      return;
    }

    const token = parsePublicAppointmentTokenFromHash(location.hash);
    setPublicToken(token);

    if (!token) {
      setError(INVALID_TOKEN_MESSAGE);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const apt = await db.getPublicAppointment(token);
      if (apt) {
        setAppointment(apt);
      } else {
        setError(INVALID_TOKEN_MESSAGE);
      }
    } catch {
      setError('無法載入訂單資料，請檢查網路連線。');
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId, location.hash]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="bg-green-900/30 text-green-400 border border-green-900/50 px-3 py-1 rounded text-sm font-bold">可預約</span>;
      case 'PENDING':
        return <span className="bg-yellow-900/30 text-yellow-400 border border-yellow-900/50 px-3 py-1 rounded text-sm font-bold flex items-center gap-1"><Clock size={14}/> 待審核</span>;
      case 'WAITING_PAYMENT':
        return <span className="bg-orange-900/30 text-orange-400 border border-orange-900/50 px-3 py-1 rounded text-sm font-bold flex items-center gap-1"><Clock size={14}/> 待付款</span>;
      case 'SIGNING':
        return <span className="bg-blue-900/30 text-blue-400 border border-blue-900/50 px-3 py-1 rounded text-sm font-bold flex items-center gap-1"><FileText size={14}/> 簽屬中</span>;
      case 'SIGNED':
        return <span className="bg-purple-900/30 text-purple-400 border border-purple-900/50 px-3 py-1 rounded text-sm font-bold flex items-center gap-1"><CheckCircle size={14}/> 簽屬完成</span>;
      case 'BOOKED':
        return <span className="bg-green-900/30 text-green-400 border border-green-900/50 px-3 py-1 rounded text-sm font-bold flex items-center gap-1"><CheckCircle size={14}/> 已確認</span>;
      case 'COMPLETED':
        return <span className="bg-gray-700 text-gray-400 border border-gray-600 px-3 py-1 rounded text-sm font-bold">已完成</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">載入中...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-6">
            <p className="text-red-400 text-lg font-bold mb-4">{error || INVALID_TOKEN_MESSAGE}</p>
            <button
              onClick={() => navigate('/')}
              className="text-white bg-red-900/50 px-4 py-2 rounded hover:bg-red-800 transition-colors"
            >
              返回首頁
            </button>
          </div>
        </div>
      </div>
    );
  }

  const consentHref = publicToken && brand?.publicOrigin
    ? buildPublicConsentUrl(brand.publicOrigin, publicToken)
    : publicToken
      ? `/consent#t=${publicToken}`
      : null;

  return (
    <div className="min-h-screen bg-dark py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft size={20} className="mr-2" /> 返回首頁
        </button>

        <div className="bg-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/20 to-primary/10 p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">預約訂單詳情</h1>
              {getStatusBadge(appointment.status)}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-dark/50 rounded-lg p-4 border border-white/5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-primary" />
                預約資訊
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 text-sm block mb-1">預約日期</span>
                  <span className="text-white font-bold text-lg">{appointment.date}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-sm block mb-1">時間</span>
                  <span className="text-white font-bold text-lg flex items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    {appointment.timeSlot}
                  </span>
                </div>
                {appointment.customerName && (
                  <div>
                    <span className="text-gray-400 text-sm block mb-1">顧客姓名</span>
                    <span className="text-white font-medium">{appointment.customerName}</span>
                  </div>
                )}
              </div>
            </div>

            {appointment.artworkTitle && (
              <div className="bg-dark/50 rounded-lg p-4 border border-white/5">
                <h2 className="text-lg font-bold text-white mb-4">圖案資訊</h2>
                <div className="flex gap-4">
                  {appointment.artworkImage && (
                    <img
                      src={appointment.artworkImage}
                      alt={appointment.artworkTitle}
                      className="w-24 h-24 rounded-lg object-cover border border-white/10"
                    />
                  )}
                  <div className="flex-1">
                    <span className="text-gray-400 text-sm block mb-1">圖案名稱</span>
                    <span className="text-white font-bold text-lg">{appointment.artworkTitle}</span>
                  </div>
                </div>
              </div>
            )}

            {(appointment.tattooPosition || appointment.tattooSize || appointment.tattooColor) && (
              <div className="bg-dark/50 rounded-lg p-4 border border-white/5">
                <h2 className="text-lg font-bold text-white mb-4">刺青細節</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {appointment.tattooPosition && (
                    <div>
                      <span className="text-gray-400 text-sm block mb-1 flex items-center gap-1">
                        <MapPin size={14} /> 部位
                      </span>
                      <span className="text-white font-medium">{appointment.tattooPosition}</span>
                    </div>
                  )}
                  {appointment.tattooSize && (
                    <div>
                      <span className="text-gray-400 text-sm block mb-1 flex items-center gap-1">
                        <Ruler size={14} /> 大小
                      </span>
                      <span className="text-white font-medium">{appointment.tattooSize}</span>
                    </div>
                  )}
                  {appointment.tattooColor && (
                    <div>
                      <span className="text-gray-400 text-sm block mb-1 flex items-center gap-1">
                        <Palette size={14} /> 色彩
                      </span>
                      <span className="text-white font-medium">{appointment.tattooColor}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(appointment.totalPrice || appointment.depositPaid) && (
              <div className="bg-dark/50 rounded-lg p-4 border border-white/5">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <DollarSign size={20} className="text-primary" />
                  價格資訊
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {appointment.totalPrice != null && (
                    <div className="bg-white/5 px-4 py-3 rounded-lg">
                      <span className="text-gray-400 block text-sm mb-1">總價</span>
                      <span className="text-white font-bold text-xl">NT$ {appointment.totalPrice.toLocaleString()}</span>
                    </div>
                  )}
                  {appointment.depositPaid != null && (
                    <div className="bg-green-900/20 px-4 py-3 rounded-lg border border-green-900/30">
                      <span className="text-green-400 block text-sm mb-1">已付訂金</span>
                      <span className="text-green-300 font-bold text-xl">NT$ {appointment.depositPaid.toLocaleString()}</span>
                    </div>
                  )}
                  {appointment.totalPrice != null && appointment.depositPaid != null && (
                    <div className="bg-yellow-900/20 px-4 py-3 rounded-lg border border-yellow-900/30">
                      <span className="text-yellow-400 block text-sm mb-1">餘額</span>
                      <span className="text-yellow-300 font-bold text-xl">
                        NT$ {(appointment.totalPrice - appointment.depositPaid).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {appointment.signed && appointment.signedAt && (
              <div className="bg-dark/50 rounded-lg p-4 border border-white/5">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <FileText size={20} className="text-primary" />
                  簽署資訊
                </h2>
                <p className="text-gray-400 text-sm">簽署時間</p>
                <p className="text-white font-medium">{appointment.signedAt}</p>
              </div>
            )}

            {appointment.status !== 'OPEN' && consentHref && (
              <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-300 font-bold mb-1">查看同意書</p>
                    <p className="text-blue-400 text-sm">點擊按鈕查看或填寫同意書</p>
                  </div>
                  <a
                    href={consentHref}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 no-underline"
                  >
                    <FileText size={18} />
                    查看同意書
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentView;
