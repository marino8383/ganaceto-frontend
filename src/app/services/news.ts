import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';

export type NewsTag = 'Avviso' | 'Evento' | 'Info' | 'Comune';

export interface NewsItem {
  id: number;
  title: string;
  body: string;
  coverImageUrl: string | null;
  tag: NewsTag;
  publishedAt: string; // ISO date string
  isVisible: boolean;
}

export interface CreateNewsDto {
  title: string;
  body: string;
  coverImageUrl: string | null;
  tag: NewsTag;
}

export interface UpdateNewsDto {
  title: string;
  body: string;
  coverImageUrl: string | null;
  tag: NewsTag;
  isVisible: boolean;
}

@Injectable({ providedIn: 'root' })
export class News {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private readonly _notizie = signal<NewsItem[]>([]);
  readonly notizie = this._notizie.asReadonly();

  loadNotizie(): void {
    this.http
      .get<NewsItem[]>(`${this.base}/api/news`)
      .subscribe((items) => this._notizie.set(items));
  }

  getById(id: number) {
    return this.http.get<NewsItem>(`${this.base}/api/news/${id}`);
  }

  // --- Admin ---

  private readonly _adminNotizie = signal<NewsItem[]>([]);
  readonly adminNotizie = this._adminNotizie.asReadonly();

  loadAdminNotizie(): void {
    this.http
      .get<NewsItem[]>(`${this.base}/api/news/admin`)
      .subscribe((items) => this._adminNotizie.set(items));
  }

  getByIdAdmin(id: number) {
    return this.http.get<NewsItem>(`${this.base}/api/news/${id}/admin`);
  }

  create(dto: CreateNewsDto) {
    return this.http.post<NewsItem>(`${this.base}/api/news`, dto);
  }

  update(id: number, dto: UpdateNewsDto) {
    return this.http.put<void>(`${this.base}/api/news/${id}`, dto);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.base}/api/news/${id}`);
  }
}
