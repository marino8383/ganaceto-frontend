import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';

export type BachecaTag =
  | 'ControlloVicinato'
  | 'Segnalazione'
  | 'Viabilita'
  | 'Parrocchia'
  | 'Info';

export interface RispostaBacheca {
  id: number;
  userDisplayName: string;
  testo: string;
  createdAt: string;
  isOwner: boolean;
}

export interface MessaggioBacheca {
  id: number;
  userDisplayName: string;
  testo: string;
  tag: BachecaTag;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  isOwner: boolean;
  isFollowing: boolean;
  risposte: RispostaBacheca[];
}

export interface CreateMessaggioDto {
  testo: string | null;
  tag: BachecaTag;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  parentId: number | null;
}

export interface BachecaType {
  value: BachecaTag;
  label: string;
  icon: string;
  color: string;
  kw: string[];
}

// Classificazione dei messaggi + parole chiave per l'auto-rilevamento (dal mockup).
export const BACHECA_TAGS: BachecaType[] = [
  {
    value: 'ControlloVicinato', label: 'Controllo Vicinato', icon: '👁️', color: '#47617e',
    kw: ['controllo', 'vicinato', 'sospett', 'ladr', 'furto', 'rubat', 'estran', 'sicurezza', 'ubriac', 'casino', 'confusione', 'schiamazz', 'rumore'],
  },
  {
    value: 'Segnalazione', label: 'Segnalazione', icon: '🔧', color: '#c0632f',
    kw: ['segnal', 'guast', 'rotto', 'danneggiat', 'perdita', 'degrado', 'rifiut', 'abbandon', 'immondizia', 'discarica'],
  },
  {
    value: 'Viabilita', label: 'Viabilità', icon: '🚧', color: '#b3402f',
    kw: ['strada', 'via', 'traffico', 'parcheggi', 'viabilit', 'buca', 'semaforo', 'lavori', 'chiusur', 'incidente', 'nazionale', 'statale', 'provinciale', 'auto', 'camion', 'veloc', 'autostrada', 'tamponament', 'scontro', 'sinistro', 'coda', 'rallentament', 'rotonda', 'svincolo', 'deviazione', 'allagat'],
  },
  {
    value: 'Parrocchia', label: 'Parrocchia', icon: '⛪', color: '#7a5a8a',
    kw: ['messa', 'parrocchia', 'chiesa', 'don ', 'catechism', 'oratorio', 'rosario', 'battesim', 'funeral'],
  },
  {
    value: 'Info', label: 'Richiesta info', icon: '❓', color: '#7a5a3a',
    kw: ['qualcuno sa', 'informazion', 'come si', 'sapete', 'vorrei sapere', 'chiedo', 'cercasi', 'cerco'],
  },
];

const MAP = new Map(BACHECA_TAGS.map((t) => [t.value, t]));
export function bachecaTag(tag: BachecaTag): BachecaType {
  return MAP.get(tag) ?? BACHECA_TAGS[BACHECA_TAGS.length - 1];
}

// Rileva il tag dal testo (priorità al contesto specifico, poi domanda → info).
export function detectTag(testo: string): BachecaTag {
  const s = (testo || '').toLowerCase();
  const hasKw = (value: BachecaTag) =>
    MAP.get(value)!.kw.some((k) => new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(s));
  for (const value of ['ControlloVicinato', 'Segnalazione', 'Parrocchia', 'Viabilita'] as BachecaTag[]) {
    if (hasKw(value)) return value;
  }
  return 'Info';
}

@Injectable({ providedIn: 'root' })
export class BachecaService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  getAll() {
    return this.http.get<MessaggioBacheca[]>(`${this.base}/api/bacheca`);
  }

  create(dto: CreateMessaggioDto) {
    return this.http.post<MessaggioBacheca>(`${this.base}/api/bacheca`, dto);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.base}/api/bacheca/${id}`);
  }

  follow(id: number) {
    return this.http.post<void>(`${this.base}/api/bacheca/${id}/follow`, {});
  }

  unfollow(id: number) {
    return this.http.delete<void>(`${this.base}/api/bacheca/${id}/follow`);
  }
}
