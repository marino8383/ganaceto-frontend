import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { News, newsType, newsTimeRange } from '../../services/news';
import { renderNewsBody } from '../../shared/format';
import { LinkPreview } from '../../components/link-preview/link-preview';

@Component({
  selector: 'app-notizie',
  imports: [DatePipe, RouterLink, LinkPreview],
  templateUrl: './notizie.html',
  styleUrl: './notizie.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notizie implements OnInit {
  private readonly newsService = inject(News);
  private readonly sanitizer = inject(DomSanitizer);
  readonly notizie = this.newsService.notizie;
  readonly tipo = newsType;
  readonly orario = newsTimeRange;
  readonly zoom = signal<string | null>(null); // src immagine ingrandita

  // contenuto delle notizie "estese" mostrato inline: HTML scritto solo dall'admin
  private readonly safeCache = new Map<string, SafeHtml>();
  safe(html: string): SafeHtml {
    let v = this.safeCache.get(html);
    if (!v) {
      v = this.sanitizer.bypassSecurityTrustHtml(renderNewsBody(html));
      this.safeCache.set(html, v);
    }
    return v;
  }

  ngOnInit(): void {
    this.newsService.loadNotizie();
  }
}
