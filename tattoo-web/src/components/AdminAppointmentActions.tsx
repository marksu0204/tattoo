import React, { useEffect, useRef } from 'react';
import { Appointment } from '../types';
import { Copy, Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

interface AdminAppointmentActionsProps {
  apt: Appointment;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  onSetDeposit: (apt: Appointment) => void;
  onConfirmReceivedDeposit: (apt: Appointment) => void;
  onCopyDepositMessage: (apt: Appointment) => void;
  onCopyConsentMessage: (apt: Appointment) => void;
  onCompleteOrder: (apt: Appointment) => void;
  onCopyLink: (id: string) => void;
  onEdit: (apt: Appointment) => void;
  onCancel: (id: string) => void;
  onUploadCustomImage?: (apt: Appointment) => void;
  onViewConsent?: (id: string) => void;
}

const AdminAppointmentActions: React.FC<AdminAppointmentActionsProps> = ({
  apt,
  openMenuId,
  setOpenMenuId,
  onSetDeposit,
  onConfirmReceivedDeposit,
  onCopyDepositMessage,
  onCopyConsentMessage,
  onCompleteOrder,
  onCopyLink,
  onEdit,
  onCancel,
  onUploadCustomImage,
  onViewConsent,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const isMenuOpen = openMenuId === apt.id;

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, setOpenMenuId]);

  const closeMenu = () => setOpenMenuId(null);

  const renderPrimarySecondary = () => {
    switch (apt.status) {
      case 'PENDING':
        return (
          <button
            onClick={() => onSetDeposit(apt)}
            className="bg-primary text-black text-xs font-bold px-3 py-1.5 rounded hover:bg-yellow-500 transition-colors"
          >
            設定訂金
          </button>
        );

      case 'WAITING_PAYMENT':
        return (
          <>
            <button
              onClick={() => onConfirmReceivedDeposit(apt)}
              className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-green-500 transition-colors"
            >
              確認已收訂金
            </button>
            <button
              onClick={() => onCopyDepositMessage(apt)}
              className="bg-blue-900/40 text-blue-300 border border-blue-800/50 text-xs font-bold px-3 py-1.5 rounded hover:bg-blue-900/60 transition-colors flex items-center gap-1"
            >
              <Copy size={12} /> 複製訂金資訊
            </button>
          </>
        );

      case 'SIGNING':
        return (
          <>
            <button
              onClick={() => onCopyConsentMessage(apt)}
              className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-blue-500 transition-colors flex items-center gap-1"
            >
              <Copy size={12} /> 複製同意書訊息
            </button>
            <button
              onClick={() => onCompleteOrder(apt)}
              className="bg-gray-700 text-gray-200 border border-gray-600 text-xs font-bold px-3 py-1.5 rounded hover:bg-gray-600 transition-colors"
            >
              完成訂單
            </button>
          </>
        );

      case 'SIGNED':
      case 'BOOKED':
        return (
          <button
            onClick={() => onCompleteOrder(apt)}
            className="bg-primary text-black text-xs font-bold px-3 py-1.5 rounded hover:bg-yellow-500 transition-colors"
          >
            完成訂單
          </button>
        );

      case 'COMPLETED':
        return null;

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 justify-end items-center">
      {renderPrimarySecondary()}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpenMenuId(isMenuOpen ? null : apt.id)}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold px-2 py-1.5 rounded border border-gray-700 flex items-center gap-1"
          aria-label="更多操作"
        >
          <MoreHorizontal size={14} />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] bg-card border border-white/10 rounded-lg shadow-xl py-1">
            <button
              type="button"
              onClick={() => { onCopyLink(apt.id); closeMenu(); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-white/5 flex items-center gap-2"
            >
              <Copy size={12} /> {apt.status === 'COMPLETED' ? '查看訂單' : '訂單連結'}
            </button>
            <button
              type="button"
              onClick={() => { onEdit(apt); closeMenu(); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-white/5 flex items-center gap-2"
            >
              <Edit size={12} /> {apt.status === 'COMPLETED' ? '編輯備註' : '編輯'}
            </button>
            {apt.status === 'SIGNED' && onViewConsent && (
              <button
                type="button"
                onClick={() => { onViewConsent(apt.id); closeMenu(); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-white/5"
              >
                查看簽署書
              </button>
            )}
            {apt.status === 'SIGNING' && apt.orderType === 'CUSTOM' && onUploadCustomImage && (
              <button
                type="button"
                onClick={() => { onUploadCustomImage(apt); closeMenu(); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-white/5 flex items-center gap-2"
              >
                <Plus size={12} />
                {apt.artworkImage ? '更換客製圖片' : '上傳客製圖片'}
              </button>
            )}
            {apt.status !== 'COMPLETED' && (
              <button
                type="button"
                onClick={() => { onCancel(apt.id); closeMenu(); }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> 取消
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAppointmentActions;
