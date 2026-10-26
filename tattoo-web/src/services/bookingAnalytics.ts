import { db } from './mockBackend';
import { BookingEventType } from '../types';

export type BookingAnalyticsPayload = {
  artworkId?: string;
  reservationId?: string;
  selectedDate?: string;
  selectedTime?: string;
};

export const trackBookingEvent = (
  eventType: BookingEventType,
  payload: BookingAnalyticsPayload = {}
): void => {
  db.recordBookingEvent({
    eventType,
    artworkId: payload.artworkId,
    reservationId: payload.reservationId,
    selectedDate: payload.selectedDate,
    selectedTime: payload.selectedTime,
  });
};
