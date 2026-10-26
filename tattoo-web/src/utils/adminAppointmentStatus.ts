import { Appointment } from '../types';

export type AdminAppointmentFilter =
  | 'all'
  | 'pending'
  | 'waiting_payment'
  | 'signing'
  | 'awaiting_session'
  | 'completed';

export const ADMIN_APPOINTMENT_FILTER_LABELS: Record<AdminAppointmentFilter, string> = {
  all: '全部',
  pending: '待審核',
  waiting_payment: '待訂金',
  signing: '待簽署',
  awaiting_session: '待施作',
  completed: '已完成',
};

export const getAdminStatusLabel = (status: Appointment['status']): string => {
  switch (status) {
    case 'PENDING':
      return '待審核';
    case 'WAITING_PAYMENT':
      return '待付訂金';
    case 'SIGNING':
      return '待簽同意書';
    case 'SIGNED':
    case 'BOOKED':
      return '待施作';
    case 'COMPLETED':
      return '已完成';
    default:
      return status;
  }
};

export const getAdminStatusBadgeClass = (status: Appointment['status']): string => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50';
    case 'WAITING_PAYMENT':
      return 'bg-orange-900/30 text-orange-400 border-orange-900/50';
    case 'SIGNING':
      return 'bg-blue-900/30 text-blue-400 border-blue-900/50';
    case 'SIGNED':
    case 'BOOKED':
      return 'bg-purple-900/30 text-purple-400 border-purple-900/50';
    case 'COMPLETED':
      return 'bg-gray-700 text-gray-400 border-gray-600';
    default:
      return 'bg-gray-800 text-gray-400 border-gray-700';
  }
};

/** Tab 待處理：PENDING + WAITING_PAYMENT + SIGNING */
export const countPendingActionAppointments = (appointments: Appointment[]): number =>
  appointments.filter((a) =>
    a.status === 'PENDING' || a.status === 'WAITING_PAYMENT' || a.status === 'SIGNING'
  ).length;

export const filterAppointments = (
  appointments: Appointment[],
  filter: AdminAppointmentFilter
): Appointment[] => {
  if (filter === 'all') return appointments;
  if (filter === 'pending') return appointments.filter((a) => a.status === 'PENDING');
  if (filter === 'waiting_payment') return appointments.filter((a) => a.status === 'WAITING_PAYMENT');
  if (filter === 'signing') return appointments.filter((a) => a.status === 'SIGNING');
  if (filter === 'awaiting_session') return appointments.filter((a) => a.status === 'SIGNED' || a.status === 'BOOKED');
  if (filter === 'completed') return appointments.filter((a) => a.status === 'COMPLETED');
  return appointments;
};

export const canCompleteAppointment = (status: Appointment['status']): boolean =>
  status === 'SIGNING' || status === 'SIGNED' || status === 'BOOKED';
