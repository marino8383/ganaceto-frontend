import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';

export interface OnlineUser {
  name: string;
  role: string;
  lastSeenAt: string;
}

export interface AccessLogRow {
  user: string;
  action: string; // "Login" | "Logout"
  device: string | null;
  at: string;
}

export interface VisitStats {
  today: number;
  week: number;
  month: number;
}

export interface AccessOverview {
  onlineRegistered: number;
  onlineGuests: number;
  online: OnlineUser[];
  log: AccessLogRow[];
  loginsRegistered: VisitStats;
  visitsGuests: VisitStats;
  registered: number;
}

@Injectable({ providedIn: 'root' })
export class Admin {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  getAccess() {
    return this.http.get<AccessOverview>(`${this.base}/api/admin/access`);
  }
}
