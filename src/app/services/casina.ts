import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';

export type BookingType = 'Private' | 'Public';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Expired' | 'CancelledByUser';

export interface CalendarBooking {
  id: number;
  slotStart: string;
  slotEnd: string;
  type: BookingType;
  status: BookingStatus; // nel calendario solo Pending o Confirmed
  title: string | null; // null = privato di qualcun altro → "Occupato"
  requesterName: string | null; // solo per admin
  isMine: boolean;
}

export interface MyBooking {
  id: number;
  slotStart: string;
  slotEnd: string;
  title: string;
  status: BookingStatus;
  rejectionReason: string | null;
  cancellableNow: boolean;
  createdAt: string;
}

export interface PendingBooking {
  id: number;
  slotStart: string;
  slotEnd: string;
  title: string;
  phone: string;
  notes: string | null;
  requesterName: string;
  createdAt: string;
}

export interface CreateBookingDto {
  slotStart: string; // ISO UTC
  slotEnd: string;
  title: string;
  phone: string;
  notes: string | null;
}

export interface AdminCreateBookingDto {
  slotStart: string;
  slotEnd: string;
  title: string;
  isPublic: boolean;
  repeatWeeks: number;
}

@Injectable({ providedIn: 'root' })
export class CasinaService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // modalità prenotazione: "weekend" | "all" (letta una volta, condivisa)
  readonly mode = signal<'weekend' | 'all'>('weekend');

  loadConfig(): void {
    this.http
      .get<{ mode: 'weekend' | 'all' }>(`${this.base}/api/casina/config`)
      .subscribe({ next: (c) => this.mode.set(c.mode), error: () => {} });
  }

  setConfig(mode: 'weekend' | 'all') {
    return this.http.put<void>(`${this.base}/api/casina/config`, { mode });
  }

  calendar(fromIso: string, toIso: string) {
    return this.http.get<CalendarBooking[]>(
      `${this.base}/api/casina/calendar?from=${fromIso}&to=${toIso}`,
    );
  }

  create(dto: CreateBookingDto) {
    return this.http.post<MyBooking>(`${this.base}/api/casina`, dto);
  }

  mine() {
    return this.http.get<MyBooking[]>(`${this.base}/api/casina/mie`);
  }

  cancel(id: number) {
    return this.http.post<void>(`${this.base}/api/casina/${id}/cancel`, {});
  }

  pending() {
    return this.http.get<PendingBooking[]>(`${this.base}/api/casina/pending`);
  }

  decide(id: number, approve: boolean, reason: string | null) {
    return this.http.post<void>(`${this.base}/api/casina/${id}/decide`, { approve, reason });
  }

  adminCreate(dto: AdminCreateBookingDto) {
    return this.http.post<{ created: number; skipped: string[] }>(
      `${this.base}/api/casina/admin`,
      dto,
    );
  }

  delete(id: number, series: boolean) {
    return this.http.delete<void>(`${this.base}/api/casina/${id}?series=${series}`);
  }
}
