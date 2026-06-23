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

  private readonly _user = signal<AuthResult | null>(this.loadFromStorage());
  readonly user = this._user.asReadonly();

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
    localStorage.removeItem(this.TOKEN_KEY);
    this._user.set(null);
    this.router.navigate(['/notizie']);
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
