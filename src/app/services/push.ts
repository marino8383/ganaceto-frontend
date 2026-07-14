import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../app.config';

// Gestisce l'iscrizione alle notifiche push (Web Push / VAPID) tramite il
// service worker di Angular. Richiede il permesso all'utente e registra
// l'iscrizione sul backend.
@Injectable({ providedIn: 'root' })
export class Push {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly swPush = inject(SwPush);

  readonly supported = this.swPush.isEnabled && typeof Notification !== 'undefined';
  readonly subscribed = signal(false);
  readonly busy = signal(false);

  constructor() {
    if (this.swPush.isEnabled) {
      this.swPush.subscription.subscribe((sub) => this.subscribed.set(!!sub));
    }
  }

  async enable(): Promise<boolean> {
    if (!this.supported || this.busy()) return false;
    this.busy.set(true);
    try {
      const { publicKey } = await firstValueFrom(
        this.http.get<{ publicKey: string }>(`${this.base}/api/push/publickey`),
      );
      const sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      const json = sub.toJSON();
      await firstValueFrom(
        this.http.post(`${this.base}/api/push/subscribe`, {
          endpoint: json.endpoint,
          p256dh: json.keys?.['p256dh'],
          auth: json.keys?.['auth'],
        }),
      );
      this.subscribed.set(true);
      return true;
    } catch {
      return false; // permesso negato o errore
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      const endpoint = sub?.endpoint;
      await this.swPush.unsubscribe();
      if (endpoint) {
        await firstValueFrom(this.http.post(`${this.base}/api/push/unsubscribe`, { endpoint }));
      }
      this.subscribed.set(false);
    } catch {
      /* ignora */
    } finally {
      this.busy.set(false);
    }
  }
}
