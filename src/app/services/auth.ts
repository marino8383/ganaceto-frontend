import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { API_BASE_URL } from '../app.config';

export interface AuthResult {
  accessToken: string;
  displayName: string;
  email: string;
  profilePicture: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = inject(API_BASE_URL);

  private readonly TOKEN_KEY = 'ganaceto_token';
  private readonly ANON_KEY = 'ganaceto_anon';
  private readonly VISIT_KEY = 'ganaceto_guest_visit';

  private readonly _user = signal<AuthResult | null>(this.loadFromStorage());
  readonly user = this._user.asReadonly();

  // numero di utenti online ora (reale, dal backend)
  readonly online = signal(0);

  get token(): string | null {
    return this._user()?.accessToken ?? null;
  }

  get isLoggedIn(): boolean {
    return this._user() !== null;
  }

  get isAdmin(): boolean {
    return this._user()?.role === 'Admin';
  }

  googleLogin(idToken: string) {
    return this.http.post<AuthResult>(`${this.base}/api/auth/google`, { idToken });
  }

  setUser(result: AuthResult): void {
    localStorage.setItem(this.TOKEN_KEY, JSON.stringify(result));
    this._user.set(result);
  }

  logout(): void {
    // registra il logout lato server finché ho ancora il token (l'interceptor lo allega ora)
    if (this.isLoggedIn) {
      this.http.post(`${this.base}/api/auth/logout`, {}).subscribe({ error: () => {} });
    }
    localStorage.removeItem(this.TOKEN_KEY);
    this._user.set(null);
    this.router.navigate(['/notizie']);
    this.refreshOnline();
  }

  // "Battito" di presenza: aggiorna LastSeen (se loggato) e legge gli online.
  // Da loggati usa /heartbeat; da ospiti /presence/guest con id anonimo di dispositivo.
  refreshOnline(): void {
    const req = this.isLoggedIn
      ? this.http.post<{ online: number }>(`${this.base}/api/auth/heartbeat`, {})
      : this.http.post<{ online: number }>(`${this.base}/api/presence/guest`, { anonId: this.anonId() });
    req.subscribe({ next: (r) => this.online.set(r.online), error: () => {} });
  }

  // Registra una visita ospite al massimo una volta al giorno per dispositivo
  // (dedup lato client: il server non salva alcun identificatore).
  trackGuestVisitOnce(): void {
    if (this.isLoggedIn) return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(this.VISIT_KEY) === today) return;
    this.http.post(`${this.base}/api/presence/visit`, {}).subscribe({
      next: () => localStorage.setItem(this.VISIT_KEY, today),
      error: () => {},
    });
  }

  // Id anonimo di dispositivo per la presenza ospiti (solo localStorage, nessun dato personale).
  private anonId(): string {
    let id = localStorage.getItem(this.ANON_KEY);
    if (!id) {
      id = crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(this.ANON_KEY, id);
    }
    return id;
  }

  private loadFromStorage(): AuthResult | null {
    try {
      const raw = localStorage.getItem(this.TOKEN_KEY);
      return raw ? (JSON.parse(raw) as AuthResult) : null;
    } catch {
      return null;
    }
  }
}
