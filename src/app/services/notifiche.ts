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
      .subscribe({
        next: (r) => {
          this.unread.set(r.count);
          this.syncBadge(r.count);
        },
        error: () => {},
      });
  }

  // Badge numerico sull'icona dell'app (App Badging API; Android/desktop, non iOS)
  private syncBadge(count: number): void {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (count > 0) nav.setAppBadge?.(count).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }

  // Carica l'elenco e poi segna tutto come letto (l'evidenza dei "nuovi" resta per questa apertura).
  openAndRead(): void {
    this.http.get<Notifica[]>(`${this.base}/api/notifications`).subscribe({
      next: (items) => {
        this._list.set(items);
        if (items.some((n) => !n.read)) {
          this.http.post(`${this.base}/api/notifications/read-all`, {}).subscribe({
            next: () => {
              this.unread.set(0);
              this.syncBadge(0);
            },
            error: () => {},
          });
        }
      },
    });
  }

  // Elimina una singola notifica (ottimistico: la tolgo subito dalla lista).
  remove(id: number): void {
    const before = this._list();
    const removed = before.find((n) => n.id === id);
    this._list.set(before.filter((n) => n.id !== id));
    if (removed && !removed.read) {
      const next = Math.max(0, this.unread() - 1);
      this.unread.set(next);
      this.syncBadge(next);
    }
    this.http.delete(`${this.base}/api/notifications/${id}`).subscribe({
      error: () => this._list.set(before), // ripristino in caso di errore
    });
  }

  // Svuota tutte le notifiche dell'utente.
  clearAll(): void {
    const before = this._list();
    this._list.set([]);
    this.unread.set(0);
    this.syncBadge(0);
    this.http.delete(`${this.base}/api/notifications`).subscribe({
      error: () => this._list.set(before),
    });
  }

  reset(): void {
    this._list.set([]);
    this.unread.set(0);
    this.syncBadge(0);
  }
}
