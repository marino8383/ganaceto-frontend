import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { News, LinkPreview as LinkPreviewData } from '../../services/news';

type Channel =
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'youtube'
  | 'telegram'
  | 'comune-modena'
  | 'solierese'
  | 'villanova'
  | 'generic';

@Component({
  selector: 'app-link-preview',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #chan>
      @if (logoSrc() && !logoError()) {
        <div class="chan-tile ch-logo">
          <img [src]="logoSrc()!" alt="" (error)="logoError.set(true)" />
        </div>
      } @else {
      <div class="chan-tile" [class]="'ch-' + channel()">
        @switch (channel()) {
          @case ('facebook') { <span class="ch-letter">f</span> }
          @case ('instagram') {
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2" />
              <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2" />
              <circle cx="17.6" cy="6.4" r="1.4" fill="currentColor" />
            </svg>
          }
          @case ('whatsapp') {
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M6.6 10.8c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          }
          @case ('youtube') { <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg> }
          @case ('telegram') { <span class="material-icons" aria-hidden="true">send</span> }
          @case ('comune-modena') { <span class="material-icons" aria-hidden="true">account_balance</span> }
          @case ('solierese') { <span class="material-icons" aria-hidden="true">sports_soccer</span> }
          @case ('villanova') { <span class="material-icons" aria-hidden="true">sports_soccer</span> }
          @default { <span class="material-icons" aria-hidden="true">link</span> }
        }
      </div>
      }
    </ng-template>

    @if (compact()) {
      <div class="lp compact">
        <div class="lp-thumb">
          @if (showImage()) {
            <img [src]="data()!.image" alt="" referrerpolicy="no-referrer" (error)="imgError.set(true)" />
          } @else {
            <ng-container [ngTemplateOutlet]="chan" />
          }
        </div>
        <div class="lp-meta">
          <span class="lp-title">{{ data()?.title || channelLabel() }}</span>
          <span class="lp-domain"><span class="material-icons" aria-hidden="true">public</span> {{ domain() }}</span>
        </div>
      </div>
    } @else {
      <a class="lp full" [href]="url()" target="_blank" rel="noopener">
        @if (showImage()) {
          <img class="lp-cover" [src]="data()!.image" alt="" referrerpolicy="no-referrer" (error)="imgError.set(true)" />
        } @else {
          <div class="lp-band"><ng-container [ngTemplateOutlet]="chan" /></div>
        }
        <div class="lp-body">
          <span class="lp-domain"><span class="material-icons" aria-hidden="true">public</span> {{ domain() }}</span>
          <span class="lp-title">{{ data()?.title || channelLabel() }}</span>
          @if (data()?.description) { <span class="lp-desc">{{ data()!.description }}</span> }
          <span class="lp-open"><span class="material-icons" aria-hidden="true">open_in_new</span> Apri l'originale</span>
        </div>
      </a>
    }
  `,
  styles: [
    `
    :host { display: block; }
    .lp-title { font-weight: 700; color: var(--text); }
    .lp-domain {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 0.74rem; color: var(--muted);
      .material-icons { font-size: 14px; }
    }

    .chan-tile { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .chan-tile svg { width: 52%; height: 52%; }
    .chan-tile .material-icons { font-size: 1.4em; }
    .ch-letter { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 2.1em; line-height: 1; }
    .ch-facebook { background: #1877f2; color: #fff; }
    .ch-instagram { background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%); color: #fff; }
    .ch-whatsapp { background: #25d366; color: #fff; }
    .ch-youtube { background: #ff0000; color: #fff; }
    .ch-telegram { background: #229ed9; color: #fff; }
    .ch-comune-modena { background: #34618e; color: #fff; }
    .ch-solierese { background: #2e7d32; color: #fff; }
    .ch-villanova { background: #1565c0; color: #fff; }
    .ch-generic { background: var(--surface-2); color: var(--muted); }
    .ch-logo { background: #fff; box-sizing: border-box; padding: 4px; }
    .ch-logo img { width: 100%; height: 100%; object-fit: contain; }

    .lp-thumb {
      width: 72px; height: 72px; border-radius: 12px; overflow: hidden;
      flex-shrink: 0; background: var(--surface-2); font-size: 20px;
    }
    .lp-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .lp.compact { display: flex; gap: 12px; align-items: center; }
    .lp.compact .lp-meta { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .lp.compact .lp-title {
      font-size: 0.95rem;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }

    .lp.full {
      display: block; width: 100%; text-align: left; text-decoration: none; color: inherit;
      border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
      background: var(--surface, #fffdf9); margin-top: 18px;
    }
    .lp.full:hover { border-color: var(--primary); }
    .lp-cover { width: 100%; max-height: 300px; object-fit: cover; display: block; background: var(--surface-2); }
    .lp-band { height: 110px; font-size: 34px; }
    .lp-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; }
    .lp.full .lp-title { font-size: 1rem; line-height: 1.3; }
    .lp-desc {
      font-size: 0.86rem; color: var(--muted); line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .lp-open {
      display: inline-flex; align-items: center; gap: 5px; margin-top: 4px;
      font-size: 0.85rem; font-weight: 700; color: var(--primary);
      .material-icons { font-size: 17px; }
    }
    `,
  ],
})
export class LinkPreview implements OnInit {
  private readonly news = inject(News);

  readonly url = input.required<string>();
  readonly compact = input(false);

  readonly data = signal<LinkPreviewData | null>(null);
  readonly loading = signal(true);
  readonly imgError = signal(false);
  readonly logoError = signal(false);

  // Logo ufficiale dell'ente (file in public/). Se manca/non carica → iconcina.
  readonly logoSrc = computed<string | null>(() => {
    switch (this.channel()) {
      case 'comune-modena': return '/logo-comune-modena.png';
      case 'solierese': return '/logo-solierese.png';
      case 'villanova': return '/logo-villanova.png';
      default: return null;
    }
  });

  readonly showImage = computed(() => !!this.data()?.image && !this.imgError());

  readonly channel = computed<Channel>(() => {
    const u = this.url().toLowerCase();
    // Enti locali prima (spesso condivisi via Facebook/sito): riconosco dal nome
    if (/comune\.modena\.it/.test(u)) return 'comune-modena';
    if (/solierese/.test(u)) return 'solierese';
    if (/villanova|4ville|pol4ville|quattroville/.test(u)) return 'villanova';
    // Piattaforme
    if (/t\.me|telegram\./.test(u)) return 'telegram';
    if (/facebook\.|fb\.me|fb\.watch/.test(u)) return 'facebook';
    if (/instagram\./.test(u)) return 'instagram';
    if (/wa\.me|whatsapp\.|chat\.whatsapp/.test(u)) return 'whatsapp';
    if (/youtube\.|youtu\.be/.test(u)) return 'youtube';
    return 'generic';
  });

  readonly channelLabel = computed(() => {
    switch (this.channel()) {
      case 'facebook': return 'Post su Facebook';
      case 'instagram': return 'Post su Instagram';
      case 'whatsapp': return 'Messaggio WhatsApp';
      case 'youtube': return 'Video su YouTube';
      case 'telegram': return 'Messaggio Telegram';
      case 'comune-modena': return 'Comune di Modena';
      case 'solierese': return 'Solierese Calcio';
      case 'villanova': return 'Polisportiva 4 Ville';
      default: return 'Apri il link';
    }
  });

  readonly domain = computed(() => {
    try {
      return new URL(this.url()).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  });

  ngOnInit(): void {
    this.news.getLinkPreview(this.url()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
