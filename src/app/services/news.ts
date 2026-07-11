import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';

export type NewsTag = 'Avviso' | 'Evento' | 'Info' | 'Comune' | 'ControlloVicinato';

export interface NewsType {
  value: NewsTag;
  label: string;
  icon: string;
  color: string;
}

// Classificazione delle notizie — unica fonte: per aggiungere/rinominare un
// tipo basta modificare questa lista (e l'enum NewsTag lato backend).
export const NEWS_TYPES: NewsType[] = [
  { value: 'Evento', label: 'Evento', icon: '🗓️', color: '#5e7d4f' },
  { value: 'Avviso', label: 'Avviso', icon: '⚠️', color: '#b3402f' },
  { value: 'ControlloVicinato', label: 'Controllo del vicinato', icon: '👁️', color: '#47617e' },
  { value: 'Info', label: 'Info', icon: 'ℹ️', color: '#7a5a3a' },
  { value: 'Comune', label: 'Comune', icon: '🏛️', color: '#8a7a5a' },
];

const NEWS_TYPE_MAP = new Map(NEWS_TYPES.map((t) => [t.value, t]));

export function newsType(tag: NewsTag): NewsType {
  return NEWS_TYPE_MAP.get(tag) ?? NEWS_TYPES[0];
}

export interface NewsItem {
  id: number;
  title: string;
  body: string;
  coverImageUrl: string | null;
  tag: NewsTag;
  publishedAt: string; // ISO date string (data di inserimento)
  isVisible: boolean;
  expandedInHome: boolean;
  referenceDate: string | null; // "yyyy-MM-dd" data di riferimento facoltativa
  startTime: string | null; // "HH:mm"
  endTime: string | null; // "HH:mm"
}

export interface CreateNewsDto {
  title: string;
  body: string;
  coverImageUrl: string | null;
  tag: NewsTag;
  expandedInHome: boolean;
  referenceDate: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface UpdateNewsDto {
  title: string;
  body: string;
  coverImageUrl: string | null;
  tag: NewsTag;
  isVisible: boolean;
  expandedInHome: boolean;
  referenceDate: string | null;
  startTime: string | null;
  endTime: string | null;
}

/** Fascia oraria leggibile: "9:00–10:00", "dalle 9:00", oppure "" */
export function newsTimeRange(item: { startTime: string | null; endTime: string | null }): string {
  if (item.startTime && item.endTime) return `${item.startTime}–${item.endTime}`;
  if (item.startTime) return `dalle ${item.startTime}`;
  if (item.endTime) return `fino alle ${item.endTime}`;
  return '';
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
