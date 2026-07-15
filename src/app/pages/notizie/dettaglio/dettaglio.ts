import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { News, NewsItem, newsType, newsTimeRange, externalChannelLabel } from '../../../services/news';
import { Auth } from '../../../services/auth';
import { renderNewsBody } from '../../../shared/format';
import { LinkPreview } from '../../../components/link-preview/link-preview';

@Component({
  selector: 'app-notizia-dettaglio',
  imports: [DatePipe, RouterLink, LinkPreview],
  templateUrl: './dettaglio.html',
  styleUrl: './dettaglio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotiziaDettaglio implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly newsService = inject(News);
  private readonly sanitizer = inject(DomSanitizer);
  readonly auth = inject(Auth);

  readonly notizia = signal<NewsItem | null>(null);
  readonly errore = signal(false);
  readonly tipo = newsType;
  readonly orario = newsTimeRange;
  readonly channelLabel = externalChannelLabel;
  readonly copied = signal(false);
  readonly zoom = signal(false);

  // Condivisione: usa il menu nativo del dispositivo se disponibile, altrimenti
  // copia il link (che punta alla pagina "vetrina" con l'anteprima social).
  async share(n: NewsItem): Promise<void> {
    const url = `${location.origin}/s/notizie/${n.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: n.title, text: n.title, url }); } catch { /* annullato */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      } catch { /* clipboard non disponibile */ }
    }
  }

  // Il corpo è HTML scritto SOLO dall'admin (rotta protetta + ruolo Admin lato
  // server): lo rendiamo come HTML fidato per preservare formattazione e
  // dimensioni delle immagini inserite dall'editor.
  readonly safeBody = computed<SafeHtml | null>(() => {
    const n = this.notizia();
    return n ? this.sanitizer.bypassSecurityTrustHtml(renderNewsBody(n.body)) : null;
  });

  // Azioni rapide admin
  modifica(n: NewsItem): void {
    this.router.navigate(['/admin/notizie'], { queryParams: { edit: n.id } });
  }

  elimina(n: NewsItem): void {
    if (!confirm(`Eliminare la notizia "${n.title}"?`)) return;
    this.newsService.delete(n.id).subscribe({
      next: () => this.router.navigate(['/notizie']),
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.newsService.getById(id).subscribe({
      next: (item) => this.notizia.set(item),
      error: () => this.errore.set(true),
    });
  }
}
