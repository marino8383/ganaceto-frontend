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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { News, NewsItem, newsType, newsTimeRange } from '../../../services/news';
import { linkifyHtml } from '../../../shared/format';

@Component({
  selector: 'app-notizia-dettaglio',
  imports: [DatePipe, RouterLink],
  templateUrl: './dettaglio.html',
  styleUrl: './dettaglio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotiziaDettaglio implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly newsService = inject(News);
  private readonly sanitizer = inject(DomSanitizer);

  readonly notizia = signal<NewsItem | null>(null);
  readonly errore = signal(false);
  readonly tipo = newsType;
  readonly orario = newsTimeRange;

  // Il corpo è HTML scritto SOLO dall'admin (rotta protetta + ruolo Admin lato
  // server): lo rendiamo come HTML fidato per preservare formattazione e
  // dimensioni delle immagini inserite dall'editor.
  readonly safeBody = computed<SafeHtml | null>(() => {
    const n = this.notizia();
    return n ? this.sanitizer.bypassSecurityTrustHtml(linkifyHtml(n.body)) : null;
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.newsService.getById(id).subscribe({
      next: (item) => this.notizia.set(item),
      error: () => this.errore.set(true),
    });
  }
}
