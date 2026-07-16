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
  // true quando lo stato dell'iscrizione è noto (evita che l'invito ad attivare
  // le notifiche lampeggi a chi è già iscritto)
  readonly known = signal(false);

  constructor() {
    if (this.swPush.isEnabled) {
      this.swPush.subscription.subscribe((sub) => {
        this.subscribed.set(!!sub);
        this.known.set(true);
      });
    }
  }

  // intento dell'utente su questo dispositivo ('1' = vuole le notifiche):
  // serve all'auto-riparazione per non riattivare a chi le ha spente apposta
  private static readonly WANTED_KEY = 'ganaceto_push_wanted';

  async enable(): Promise<boolean> {
    if (!this.supported || this.busy()) return false;
    this.busy.set(true);
    try {
      const { publicKey } = await firstValueFrom(
        this.http.get<{ publicKey: string }>(`${this.base}/api/push/publickey`),
      );
      const sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      await this.registerOnServer(sub);
      this.subscribed.set(true);
      localStorage.setItem(Push.WANTED_KEY, '1');
      return true;
    } catch {
      return false; // permesso negato o errore
    } finally {
      this.busy.set(false);
    }
  }

  // Auto-riparazione (da chiamare a ogni apertura, utente loggato): Chrome può
  // ruotare o invalidare l'iscrizione in silenzio — l'utente crede di essere
  // iscritto ma non riceve più nulla. Qui, se il permesso è concesso:
  // - iscrizione presente → la ri-registra sul server (upsert per endpoint);
  // - iscrizione sparita ma l'utente la voleva → la ricrea (senza prompt).
  async sync(): Promise<void> {
    if (!this.supported || Notification.permission !== 'granted' || this.busy()) return;
    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      if (sub) {
        localStorage.setItem(Push.WANTED_KEY, '1'); // migrazione: iscritti pre-flag
        await this.registerOnServer(sub);
      } else if (localStorage.getItem(Push.WANTED_KEY) === '1') {
        await this.enable(); // permesso già concesso: nessun prompt
      }
    } catch {
      /* rete assente o simili: riproverà alla prossima apertura */
    }
  }

  private async registerOnServer(sub: PushSubscription): Promise<void> {
    const json = sub.toJSON();
    await firstValueFrom(
      this.http.post(`${this.base}/api/push/subscribe`, {
        endpoint: json.endpoint,
        p256dh: json.keys?.['p256dh'],
        auth: json.keys?.['auth'],
      }),
    );
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
      localStorage.setItem(Push.WANTED_KEY, '0'); // scelta esplicita: niente auto-riparazione
    } catch {
      /* ignora */
    } finally {
      this.busy.set(false);
    }
  }
}
