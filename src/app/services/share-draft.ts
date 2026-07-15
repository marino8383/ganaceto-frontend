import { Injectable } from '@angular/core';

export interface ShareDraft {
  title: string;
  text: string;
  url: string;
}

// Trasporta una bozza condivisa (da Web Share Target o incolla manuale)
// dalla pagina /condividi al form di destinazione (notizia o bacheca).
@Injectable({ providedIn: 'root' })
export class ShareDraftService {
  private draft: ShareDraft | null = null;

  set(d: ShareDraft): void {
    this.draft = d;
  }

  // Legge e azzera la bozza (una volta sola).
  consume(): ShareDraft | null {
    const d = this.draft;
    this.draft = null;
    return d;
  }
}
