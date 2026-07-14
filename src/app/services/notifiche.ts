import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';

export type NotificaKind = 'Generic' | 'News' | 'Booking' | 'Adesione' | 'Bacheca' | 'Sondaggio';

export interface Notifica {
  id: number;
  kind: NotificaKind;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class Notifiche {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  readonly unread = signal(0);
  private readonly _list = signal<Notifica[]>([]);
  readonly list = this._list.asReadonly();

  refreshCount(): void {
    this.http
      .get<{ count: number }>(`${this.base}/api/notifications/unread-count`)
      .subscribe({ next: (r) => this.unread.set(r.count), error: () => {} });
  }

  // Carica l'elenco e poi segna tutto come letto (l'evidenza dei "nuovi" resta per questa apertura).
  openAndRead(): void {
    this.http.get<Notifica[]>(`${this.base}/api/notifications`).subscribe({
      next: (items) => {
        this._list.set(items);
        if (items.some((n) => !n.read)) {
          this.http.post(`${this.base}/api/notifications/read-all`, {}).subscribe({
            next: () => this.unread.set(0),
            error: () => {},
          });
        }
      },
    });
  }

  reset(): void {
    this._list.set([]);
    this.unread.set(0);
  }
}
