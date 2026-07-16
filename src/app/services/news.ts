import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { API_BASE_URL } from '../app.config';

export type NewsTag = 'Avviso' | 'Evento' | 'Info' | 'Comune' | 'ControlloVicinato' | 'News';

export type CoverSize = 'small' | 'medium' | 'large' | 'side';

export interface NewsType {
  value: NewsTag;
  label: string;
  icon: string;
  color: string; // colore della pill
  text: string; // colore del testo sopra la pill (bianco, o scuro se pill chiara)
  accent: string; // colore della striscia laterale della card
}

// Classificazione delle notizie â€” unica fonte: per aggiungere/rinominare un
// tipo basta modificare questa lista (e l'enum NewsTag lato backend).
export const NEWS_TYPES: NewsType[] = [
  { value: 'Evento', label: 'Evento', icon: 'ðŸ—“ï¸', color: '#5e7d4f', text: '#fff', accent: '#5e7d4f' },
  { value: 'Avviso', label: 'Avviso', icon: 'âš ï¸', color: '#b3402f', text: '#fff', accent: '#b3402f' },
  { value: 'ControlloVicinato', label: 'Controllo del vicinato', icon: 'ðŸ‘ï¸', color: '#47617e', text: '#fff', accent: '#47617e' },
  { value: 'Info', label: 'Info', icon: 'â„¹ï¸', color: '#7a5a3a', text: '#fff', accent: '#7a5a3a' },
  { value: 'Comune', label: 'Comune', icon: 'ðŸ›ï¸', color: '#8a7a5a', text: '#fff', accent: '#8a7a5a' },
  // News: pill bianca, ma la striscia della card usa il bordo neutro (niente striscia invisibile)
  { value: 'News', label: 'News', icon: 'ðŸ“°', color: '#ffffff', text: '#1c1b17', accent: 'var(--line)' },
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
  coverSize: CoverSize | null;
  externalUrl: string | null;
  atCasina: boolean;
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
  coverSize: CoverSize | null;
  externalUrl: string | null;
  atCasina: boolean;
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
  coverSize: CoverSize | null;
  externalUrl: string | null;
  atCasina: boolean;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

/** Etichetta del bottone in base al canale del link esterno. */
export function externalChannelLabel(url: string): string {
  const u = (url || '').toLowerCase();
  if (u.includes('facebook.') || u.includes('fb.me') || u.includes('fb.watch')) return 'Apri su Facebook';
  if (u.includes('instagram.')) return 'Apri su Instagram';
  if (u.includes('wa.me') || u.includes('whatsapp.') || u.includes('chat.whatsapp')) return 'Apri su WhatsApp';
  return 'Apri il post originale';
}

/** Fascia oraria leggibile: "9:00â€“10:00", "dalle 9:00", oppure "" */
export function newsTimeRange(item: { startTime: string | null; endTime: string | null }): string {
  if (item.startTime && item.endTime) return `${item.startTime}â€“${item.endTime}`;
  if (item.startTime) return `dalle ${item.startTime}`;
  if (item.endTime) return `fino alle ${item.endTime}`;
  return '';
}

@Injectable({ providedIn: 'root' })
export class News {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private static readonly CACHE_KEY = 'ganaceto_news';

  // idratato da localStorage: al refresh le notizie compaiono subito, poi si aggiornano
  private readonly _notizie = signal<NewsItem[]>(this.readCache());
  readonly notizie = this._notizie.asReadonly();

  private readCache(): NewsItem[] {
    try {
      const raw = localStorage.getItem(News.CACHE_KEY);
      return raw ? (JSON.parse(raw) as NewsItem[]) : [];
    } catch {
      return [];
    }
  }

  // cache in sessione delle anteprime link (il backend ha giÃ  la sua)
  private readonly previewCache = new Map<string, LinkPreview>();

  getLinkPreview(url: string): Observable<LinkPreview> {
    const cached = this.previewCache.get(url);
    if (cached) return of(cached);
    return this.http
      .get<LinkPreview>(`${this.base}/api/link-preview`, { params: { url } })
      .pipe(tap((p) => this.previewCache.set(url, p)));
  }

  loadNotizie(): void {
    this.http.get<NewsItem[]>(`${this.base}/api/news`).subscribe((items) => {
      this._notizie.set(items);
      try {
        localStorage.setItem(News.CACHE_KEY, JSON.stringify(items));
      } catch {
        /* storage pieno/non disponibile: ignora */
      }
    });
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
