
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { trackBookingEvent } from '../services/bookingAnalytics';
import { lineService } from '../services/lineService';
import { Appointment, UserRole, Artwork, AvailabilityWindow } from '../types';
import { useApp } from '../App';
import { useBrand } from '../context/BrandContext';
import { getCalendarRegionNotice, getCalendarRegionSubline } from '../utils/brandPresentation';
import { buildLineInquiryUrl, hasBrandLineContact } from '../utils/brandContact';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildCalendarSeo } from '../utils/seoConfig';
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, User, FileText,
  Calendar as CalendarIcon, Phone, PenTool, MessageCircle, MapPin, ArrowLeft, CheckCircle2
} from 'lucide-react';
import {
  dateHasAvailability,
  getAvailableTimesForDate,
} from '../utils/bookingTimeSlots';

type GuestStep = 'calendar' | 'time' | 'confirm' | 'success';

interface SuccessReservation {
  id: string;
  date: string;
  timeSlot: string;
  artworkTitle?: string;
  artworkId?: string;
  publicAppointmentUrl?: string;
  publicConsentUrl?: string;
}

const CalendarPage: React.FC = () => {
  const { user } = useApp();
  const { brand } = useBrand();
  usePageSeo(buildCalendarSeo(brand));
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [legacyOpenSlots, setLegacyOpenSlots] = useState<Array<{ id: string; date: string; timeSlot: string }>>([]);
  const [bookedSlots, setBookedSlots] = useState<Array<{ date: string; timeSlot: string }>>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);

  // Guest progressive flow
  const [guestStep, setGuestStep] = useState<GuestStep>('calendar');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState('');
  const [successReservation, setSuccessReservation] = useState<SuccessReservation | null>(null);
  const bookingStartTracked = useRef(false);

  // Admin modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWindowModalOpen, setIsWindowModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [editingWindow, setEditingWindow] = useState<AvailabilityWindow | null>(null);

  // Admin appointment form
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('10:00');
  const [formStatus, setFormStatus] = useState<Appointment['status']>('OPEN');
  const [formCustomer, setFormCustomer] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formArtworkTitle, setFormArtworkTitle] = useState('');
  const [formTotalPrice, setFormTotalPrice] = useState('');
  const [formDepositPaid, setFormDepositPaid] = useState('');

  // Admin window form
  const [windowDate, setWindowDate] = useState('');
  const [windowStartTime, setWindowStartTime] = useState('10:00');
  const [windowEndTime, setWindowEndTime] = useState('18:00');
  const [windowInterval, setWindowInterval] = useState<30 | 60>(30);

  useEffect(() => {
    const navArtwork = (location.state as { artwork?: Artwork } | null)?.artwork ?? null;
    if (navArtwork) {
      setSelectedArtwork(navArtwork);
    }
  }, [location]);

  useEffect(() => {
    if (isAdmin || !user || bookingStartTracked.current) return;
    bookingStartTracked.current = true;
    const navArtwork = (location.state as { artwork?: Artwork } | null)?.artwork;
    trackBookingEvent('booking_start', { artworkId: navArtwork?.id });
  }, [isAdmin, user, location]);

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    if (isAdmin) {
      const [apts, wins] = await Promise.all([
        db.getAppointments(),
        db.getAvailabilityWindows(),
      ]);
      setAppointments(apts);
      setWindows(wins);
    } else {
      const [calendarData] = await Promise.all([db.getBookingCalendarData()]);
      setWindows(calendarData.windows);
      setLegacyOpenSlots(calendarData.legacyOpenSlots);
      setBookedSlots(calendarData.bookedSlots);
    }
  };

  const getDaysInMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const formatDateStr = (day: number) =>
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isPastDate = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate <= today;
  };

  const getAppointmentsForDay = (day: number) => {
    const dateStr = formatDateStr(day);
    return appointments
      .filter((a) => a.date === dateStr)
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  };

  const getWindowsForDay = (day: number) => {
    const dateStr = formatDateStr(day);
    return windows.filter((w) => w.date === dateStr);
  };

  const availableTimes = useMemo(() => {
    if (!selectedDate) return [];
    return getAvailableTimesForDate(selectedDate, windows, legacyOpenSlots, bookedSlots);
  }, [selectedDate, windows, legacyOpenSlots, bookedSlots]);

  const formatDisplayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${m}/${d}`;
  };

  const formatFullDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  };

  // --- Admin handlers ---

  const openNewWindowModal = (day: number) => {
    setEditingWindow(null);
    setWindowDate(formatDateStr(day));
    setWindowStartTime('10:00');
    setWindowEndTime('18:00');
    setWindowInterval(30);
    setIsWindowModalOpen(true);
  };

  const openEditWindowModal = (window: AvailabilityWindow) => {
    setEditingWindow(window);
    setWindowDate(window.date);
    setWindowStartTime(window.startTime);
    setWindowEndTime(window.endTime);
    setWindowInterval(window.intervalMinutes);
    setIsWindowModalOpen(true);
  };

  const handleSaveWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: AvailabilityWindow = {
      id: editingWindow?.id ?? Date.now().toString(),
      date: windowDate,
      startTime: windowStartTime,
      endTime: windowEndTime,
      intervalMinutes: windowInterval,
    };
    await db.saveAvailabilityWindow(payload);
    setIsWindowModalOpen(false);
    loadData();
  };

  const handleDeleteWindow = async () => {
    if (!editingWindow) return;
    if (window.confirm('確定要刪除此可預約時間區間嗎？')) {
      await db.deleteAvailabilityWindow(editingWindow.id);
      setIsWindowModalOpen(false);
      loadData();
    }
  };

  const openEditModal = (apt: Appointment) => {
    setEditingApt(apt);
    setFormDate(apt.date);
    setFormTime(apt.timeSlot);
    setFormStatus(apt.status);
    setFormCustomer(apt.customerName || '');
    setFormPhone(apt.phoneNumber || '');
    setFormNotes(apt.notes || '');
    setFormArtworkTitle(apt.artworkTitle || '');
    setFormTotalPrice(apt.totalPrice ? apt.totalPrice.toString() : '');
    setFormDepositPaid(apt.depositPaid ? apt.depositPaid.toString() : '');
    setIsModalOpen(true);
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const isOccupied = formStatus !== 'OPEN';
    const preserveUser = isOccupied && editingApt?.userId;

    const appointmentData: Appointment = {
      id: editingApt!.id,
      date: formDate,
      timeSlot: formTime,
      status: formStatus,
      customerName: formCustomer,
      phoneNumber: formPhone,
      notes: formNotes,
      userId: preserveUser ? editingApt!.userId : undefined,
      artworkId: editingApt?.artworkId,
      artworkTitle: formArtworkTitle,
      artworkImage: editingApt?.artworkImage,
      totalPrice: formTotalPrice ? parseInt(formTotalPrice) : undefined,
      depositPaid: formDepositPaid ? parseInt(formDepositPaid) : undefined,
    };

    await db.saveAppointment(appointmentData);
    setIsModalOpen(false);
    loadData();
  };

  const handleDeleteApt = async () => {
    if (!editingApt) return;
    if (window.confirm('確定要刪除這個預約嗎？')) {
      await db.deleteAppointment(editingApt.id);
      setIsModalOpen(false);
      loadData();
    }
  };

  // --- Guest handlers ---

  const handleSelectDate = (day: number) => {
    if (isPastDate(day)) return;
    const dateStr = formatDateStr(day);
    if (!dateHasAvailability(dateStr, windows, legacyOpenSlots)) return;

    setSelectedDate(dateStr);
    setSelectedTime(null);
    setGuestStep('time');
    trackBookingEvent('booking_date_selected', {
      artworkId: selectedArtwork?.id,
      selectedDate: dateStr,
    });
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
    setGuestStep('confirm');
    trackBookingEvent('booking_time_selected', {
      artworkId: selectedArtwork?.id,
      selectedDate: selectedDate ?? undefined,
      selectedTime: time,
    });
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDate || !selectedTime) return;

    const lineAccessToken = lineService.getAccessToken();
    if (!lineAccessToken) {
      window.alert('LINE登入狀態失效，請重新登入後再預約。');
      navigate('/login', { state: { returnTo: '/calendar' } });
      return;
    }

    trackBookingEvent('booking_submit', {
      artworkId: selectedArtwork?.id,
      selectedDate,
      selectedTime,
    });

    const legacySlot = legacyOpenSlots.find(
      (s) => s.date === selectedDate && s.timeSlot === selectedTime
    );

    const reservationId = legacySlot?.id ?? Date.now().toString();
    const appointmentData: Appointment = {
      id: reservationId,
      date: selectedDate,
      timeSlot: selectedTime,
      status: 'PENDING',
      userId: user.id,
      customerName: user.name,
      phoneNumber: userPhone.trim(),
      orderType: 'CLAIMED',
      notes: selectedArtwork ? `預約認領圖: ${selectedArtwork.title}` : '線上預約',
      artworkId: selectedArtwork?.id,
      artworkTitle: selectedArtwork?.title,
      artworkImage: selectedArtwork?.imageUrl,
    };

    const saveResult = legacySlot
      ? await db.saveAppointment({ ...legacySlot, ...appointmentData, status: 'PENDING' } as Appointment, lineAccessToken)
      : await db.saveAppointment(appointmentData, lineAccessToken);

    trackBookingEvent('booking_complete', {
      artworkId: selectedArtwork?.id,
      reservationId,
      selectedDate,
      selectedTime,
    });

    setSuccessReservation({
      id: reservationId,
      date: selectedDate,
      timeSlot: selectedTime,
      artworkTitle: selectedArtwork?.title,
      artworkId: selectedArtwork?.id,
      publicAppointmentUrl: saveResult.publicAppointmentUrl,
      publicConsentUrl: saveResult.publicConsentUrl,
    });
    setGuestStep('success');
    loadData();
  };

  const getLineUrl = () => {
    if (!successReservation) return null;
    const artInfo = successReservation.artworkTitle
      ? `\n🖼️ 預約圖案: ${successReservation.artworkTitle}${successReservation.artworkId ? ` (ID: ${successReservation.artworkId})` : ''}`
      : '';
    const appointmentLink = successReservation.publicAppointmentUrl
      ? `\n📋 查看預約: ${successReservation.publicAppointmentUrl}`
      : '';
    const message = `你好！我已送出預約申請：\n\n📅 日期: ${successReservation.date}\n⏰ 希望時間: ${successReservation.timeSlot}${artInfo}\n📞 電話: ${userPhone}${appointmentLink}\n\n請協助確認施作時間與訂金，謝謝！`;
    navigator.clipboard.writeText(message).catch(() => {});
    return buildLineInquiryUrl(message, brand);
  };

  const handleLineClick = () => {
    trackBookingEvent('booking_line_click', {
      artworkId: successReservation?.artworkId,
      reservationId: successReservation?.id,
      selectedDate: successReservation?.date,
      selectedTime: successReservation?.timeSlot,
    });
  };

  const goBackToArtwork = () => {
    if (successReservation?.artworkId) {
      navigate(`/artwork/${successReservation.artworkId}`);
    } else {
      navigate('/');
    }
  };

  const [copyLinkStatus, setCopyLinkStatus] = useState('');

  const handleCopyCustomerLink = async () => {
    if (!editingApt || editingApt.status === 'OPEN') return;
    setCopyLinkStatus('loading');
    const links = await db.getAdminAppointmentPublicLinks(editingApt.id);
    if (!links?.appointmentUrl) {
      setCopyLinkStatus('error');
      alert('無法取得顧客連結，請稍後再試。');
      return;
    }
    await navigator.clipboard.writeText(links.appointmentUrl);
    setCopyLinkStatus('done');
    alert('顧客連結已複製！');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-green-900/20 text-green-400 border-green-900/50 hover:bg-green-900/40';
      case 'PENDING': return 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50 hover:bg-yellow-900/40';
      case 'WAITING_PAYMENT': return 'bg-orange-900/20 text-orange-400 border-orange-900/50 hover:bg-orange-900/40';
      case 'SIGNING': return 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/40';
      case 'SIGNED': return 'bg-purple-900/20 text-purple-400 border-purple-900/50 hover:bg-purple-900/40';
      case 'BOOKED': return 'bg-red-900/20 text-red-400 border-red-900/50 hover:bg-red-900/40';
      case 'COMPLETED': return 'bg-gray-700 text-gray-400 border-gray-600';
      default: return 'bg-gray-800';
    }
  };

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const daysInMonth = getDaysInMonth(currentDate);

  // --- Success Screen ---
  if (!isAdmin && guestStep === 'success' && successReservation) {
    const successLineUrl = getLineUrl();
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-card rounded-2xl border border-white/10 p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-green-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">預約申請已送出</h1>
          <div className="bg-white/5 rounded-lg p-4 mb-4 text-left">
            <p className="text-white font-bold text-lg">
              {formatDisplayDate(successReservation.date)} {successReservation.timeSlot}
            </p>
            {successReservation.artworkTitle && (
              <p className="text-gray-300 mt-1">{successReservation.artworkTitle}</p>
            )}
            <p className="text-yellow-400 text-sm mt-2">目前狀態：待確認</p>
          </div>
          <p className="text-gray-300 text-sm mb-6 leading-relaxed">
            {hasBrandLineContact(brand)
              ? '請透過 LINE 與我們確認施作時間與訂金，完成確認後預約才正式成立。'
              : '預約申請已送出，刺青師將與您聯繫確認施作時間與訂金。'}
          </p>
          {successReservation.publicAppointmentUrl && (
            <a
              href={successReservation.publicAppointmentUrl}
              className="w-full bg-primary text-black font-bold py-3 rounded-lg flex items-center justify-center transition-colors shadow-lg mb-3 no-underline hover:bg-yellow-500"
            >
              查看預約資料
            </a>
          )}
          {successLineUrl && (
          <a
            href={successLineUrl}
            target="_blank"
            rel="noreferrer"
            onClick={handleLineClick}
            className="w-full bg-[#06c755] hover:bg-[#05b34c] text-white font-bold py-3 rounded-lg flex items-center justify-center transition-colors shadow-lg mb-3 no-underline"
          >
            <MessageCircle className="mr-2" size={20} />
            LINE 聯繫確認
          </a>
          )}
          <button
            onClick={goBackToArtwork}
            className="w-full bg-white/5 hover:bg-white/10 text-gray-300 font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={18} />
            {successReservation.artworkId
              ? `回到「${successReservation.artworkTitle}」作品頁`
              : '回作品集'}
          </button>
          <p className="text-xs text-gray-600 mt-6">
            若 24 小時內未收到聯繫，預約可能會被取消。
          </p>
        </div>
      </div>
    );
  }

  // --- Guest Time Selection ---
  if (!isAdmin && guestStep === 'time' && selectedDate) {
    return (
      <div className="max-w-lg mx-auto px-4 pb-12">
        <button
          onClick={() => { setGuestStep('calendar'); setSelectedTime(null); }}
          className="flex items-center gap-1 text-gray-400 hover:text-white mb-4 mt-4 transition-colors"
        >
          <ArrowLeft size={18} /> 返回選擇日期
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">選擇希望預約時間</h1>
        <p className="text-primary font-medium mb-1">{formatFullDate(selectedDate)}</p>
        <p className="text-gray-400 text-sm mb-6">此為希望時間，送出後仍需由刺青師確認。</p>

        {selectedArtwork && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 mb-6 flex items-center gap-3">
            <img src={selectedArtwork.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
            <p className="text-primary font-bold text-sm">預約圖案：{selectedArtwork.title}</p>
          </div>
        )}

        {availableTimes.length === 0 ? (
          <p className="text-gray-400 text-center py-8">此日期已無可選時間</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {availableTimes.map((time) => (
              <button
                key={time}
                onClick={() => handleSelectTime(time)}
                className={`py-3 px-2 rounded-xl border font-bold text-sm transition-all active:scale-95 ${
                  selectedTime === time
                    ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                    : 'bg-card text-white border-white/10 hover:border-primary/50'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Guest Confirm (phone) ---
  if (!isAdmin && guestStep === 'confirm' && selectedDate && selectedTime) {
    return (
      <div className="max-w-lg mx-auto px-4 pb-12">
        <button
          onClick={() => setGuestStep('time')}
          className="flex items-center gap-1 text-gray-400 hover:text-white mb-4 mt-4 transition-colors"
        >
          <ArrowLeft size={18} /> 返回選擇時間
        </button>
        <h1 className="text-2xl font-bold text-white mb-6">確認預約資訊</h1>

        <div className="bg-primary/10 border border-primary/30 p-4 rounded-lg mb-6">
          <p className="text-primary font-bold text-lg">
            {formatFullDate(selectedDate)} {selectedTime}
          </p>
          {selectedArtwork && (
            <p className="text-gray-300 mt-2">預約圖案：{selectedArtwork.title}</p>
          )}
        </div>

        <form onSubmit={handleConfirmBooking} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
              <Phone size={12} /> 手機號碼
            </label>
            <input
              type="tel"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="0912-345-678"
              className="w-full bg-card border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none text-lg"
              required
            />
          </div>

          <p className="text-sm text-gray-400">
            此為希望預約時間，送出後仍需由刺青師確認。
          </p>

          <button
            type="submit"
            className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-500 shadow-lg shadow-primary/20 text-lg"
          >
            送出預約申請
          </button>
        </form>
      </div>
    );
  }

  // --- Main Calendar View (Guest step calendar + Admin) ---
  return (
    <div className="max-w-7xl mx-auto px-4 pb-12 relative">
      <div className="sticky top-16 z-40 bg-dark pt-4 pb-4 -mx-4 px-4 border-b border-white/10 mb-4 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 max-w-7xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {isAdmin ? '排程管理' : '預約時段'}
          </h1>
          <div className="flex items-center gap-4 bg-card px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="text-lg font-medium w-40 text-center select-none text-primary">
              {currentDate.toLocaleString('zh-TW', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {!isAdmin && (
          <div className="mt-4 max-w-7xl mx-auto bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-start gap-2">
            <MapPin size={18} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-white">{getCalendarRegionNotice(brand)}</p>
              {getCalendarRegionSubline(brand) && (
                <p className="text-gray-400">{getCalendarRegionSubline(brand)}</p>
              )}
            </div>
          </div>
        )}

        {selectedArtwork && !isAdmin && (
          <div className="mt-4 max-w-7xl mx-auto bg-primary/10 border border-primary text-primary px-4 py-3 rounded-lg flex items-center gap-3">
            <img src={selectedArtwork.imageUrl} alt="" className="w-10 h-10 rounded object-cover border border-primary/50" />
            <div>
              <p className="font-bold text-sm">正在預約：{selectedArtwork.title}</p>
              <p className="text-xs opacity-80">請選擇日期與希望時間</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-800 border border-gray-800 rounded-xl overflow-hidden shadow-2xl mt-4">
        {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
          <div key={day} className="bg-dark py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-500">
            {day}
          </div>
        ))}

        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-card/50 min-h-[100px] md:min-h-[120px]" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDateStr(day);
          const dayAppointments = getAppointmentsForDay(day);
          const dayWindows = getWindowsForDay(day);
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
          const isPast = isPastDate(day);
          const hasAvailability = !isPast && dateHasAvailability(dateStr, windows, legacyOpenSlots);

          return (
            <div
              key={day}
              className={`bg-card min-h-[100px] md:min-h-[120px] p-2 transition-colors relative group border-t border-l border-white/5 ${
                isToday ? 'bg-white/5' : isPast && !isAdmin ? 'bg-gray-900/50 opacity-50' : 'hover:bg-gray-800'
              }`}
            >
              <span className={`text-sm font-bold block mb-2 ${isToday ? 'text-primary' : isPast ? 'text-gray-600' : 'text-gray-400'}`}>
                {day}
              </span>

              {isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); openNewWindowModal(day); }}
                  className="absolute top-2 right-2 text-gray-600 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="新增可預約時間區間"
                >
                  <Plus size={18} />
                </button>
              )}

              {!isAdmin && hasAvailability && (
                <button
                  onClick={() => handleSelectDate(day)}
                  className="w-full mt-1 py-2 px-2 rounded-lg bg-green-900/30 border border-green-700/50 text-green-400 text-xs font-bold hover:bg-green-900/50 transition-colors"
                >
                  可預約
                </button>
              )}

              {isAdmin && dayWindows.map((w) => (
                <div
                  key={w.id}
                  onClick={() => openEditWindowModal(w)}
                  className="text-xs px-2 py-1.5 rounded border cursor-pointer mb-1 bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40 transition-transform hover:scale-[1.02]"
                >
                  <span className="font-bold">{w.startTime}–{w.endTime}</span>
                  <span className="text-[10px] ml-1 opacity-70">/{w.intervalMinutes}分</span>
                </div>
              ))}

              {isAdmin && (
                <div className="space-y-1 overflow-y-auto max-h-[60px] no-scrollbar mt-1">
                  {dayAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      onClick={() => openEditModal(apt)}
                      className={`text-xs px-2 py-1 rounded border cursor-pointer truncate transition-transform hover:scale-[1.02] flex items-center gap-1 ${getStatusColor(apt.status)}`}
                    >
                      <span className="font-bold whitespace-nowrap">{apt.timeSlot}</span>
                      {apt.artworkImage && (
                        <img src={apt.artworkImage} className="w-3 h-3 rounded-full object-cover flex-shrink-0" alt="" />
                      )}
                      <span className="truncate">{apt.customerName || apt.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Admin: Edit Appointment Modal */}
      {isModalOpen && editingApt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-dark/50 sticky top-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText size={20} className="text-primary" /> 編輯預約
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveAdmin} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">日期</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">時間</label>
                  <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">狀態</label>
                <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as Appointment['status'])}
                  className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none">
                  <option value="OPEN">🟢 Open (可預約)</option>
                  <option value="PENDING">🟡 Pending (待審核)</option>
                  <option value="WAITING_PAYMENT">🟠 Waiting Payment (待付款)</option>
                  <option value="SIGNING">🔵 Signing (簽屬中)</option>
                  <option value="SIGNED">🟣 Signed (簽屬完成)</option>
                  <option value="BOOKED">🔴 Booked (已確認)</option>
                  <option value="COMPLETED">⚫ Completed (已完成)</option>
                </select>
              </div>
              <div className={`space-y-4 p-4 rounded-lg border border-white/5 bg-white/5 ${formStatus === 'OPEN' ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><User size={12} /> 顧客姓名</label>
                  <input type="text" value={formCustomer} onChange={(e) => setFormCustomer(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Phone size={12} /> 手機號碼</label>
                  <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><PenTool size={12} /> 作品資訊</label>
                  <input type="text" value={formArtworkTitle} onChange={(e) => setFormArtworkTitle(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">備註</label>
                  <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white h-16 text-sm focus:border-primary focus:outline-none resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">💰 總價 (NT$)</label>
                    <input type="number" value={formTotalPrice} onChange={(e) => setFormTotalPrice(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">✅ 已付訂金 (NT$)</label>
                    <input type="number" value={formDepositPaid} onChange={(e) => setFormDepositPaid(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                {formStatus !== 'OPEN' && (
                  <button
                    type="button"
                    onClick={handleCopyCustomerLink}
                    disabled={copyLinkStatus === 'loading'}
                    className="flex-1 bg-blue-900/30 text-blue-300 border border-blue-800 font-bold py-3 rounded-lg hover:bg-blue-900/50"
                  >
                    {copyLinkStatus === 'loading' ? '取得中…' : '複製顧客連結'}
                  </button>
                )}
                <button type="button" onClick={handleDeleteApt}
                  className="flex-1 bg-red-900/30 text-red-400 border border-red-900 font-bold py-3 rounded-lg hover:bg-red-900/50 flex items-center justify-center gap-2">
                  <Trash2 size={18} /> 刪除
                </button>
                <button type="submit" className="flex-[2] bg-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-500 shadow-lg shadow-primary/20">
                  更新預約
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin: Availability Window Modal */}
      {isWindowModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-dark/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock size={20} className="text-primary" />
                {editingWindow ? '編輯可預約區間' : '新增可預約時間區間'}
              </h3>
              <button onClick={() => setIsWindowModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveWindow} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                  <CalendarIcon size={12} /> 日期
                </label>
                <input type="date" value={windowDate} onChange={(e) => setWindowDate(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">開始時間</label>
                  <input type="time" value={windowStartTime} onChange={(e) => setWindowStartTime(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">結束時間</label>
                  <input type="time" value={windowEndTime} onChange={(e) => setWindowEndTime(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">客人可選間隔</label>
                <select value={windowInterval} onChange={(e) => setWindowInterval(Number(e.target.value) as 30 | 60)}
                  className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none">
                  <option value={30}>30 分鐘</option>
                  <option value={60}>60 分鐘</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">
                客人將在此區間內自行選擇希望預約時間，預約仍為待確認狀態。
              </p>
              <div className="flex gap-3 pt-2">
                {editingWindow && (
                  <button type="button" onClick={handleDeleteWindow}
                    className="flex-1 bg-red-900/30 text-red-400 border border-red-900 font-bold py-3 rounded-lg hover:bg-red-900/50 flex items-center justify-center gap-2">
                    <Trash2 size={18} /> 刪除
                  </button>
                )}
                <button type="submit" className="flex-[2] bg-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-500 shadow-lg shadow-primary/20">
                  {editingWindow ? '更新區間' : '建立區間'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
