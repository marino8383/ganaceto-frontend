import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { News, LinkPreview as LinkPreviewData } from '../../services/news';

@Component({
  selector: 'app-link-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compact()) {
      <div class="lp compact">
        @if (data()?.image) {
          <img class="lp-thumb" [src]="data()!.image" alt="" referrerpolicy="no-referrer" />
        } @else {
          <div class="lp-thumb lp-ph"><span class="material-icons" aria-hidden="true">link</span></div>
        }
        <div class="lp-meta">
          <span class="lp-title">{{ data()?.title || domain() }}</span>
          <span class="lp-domain"><span class="material-icons" aria-hidden="true">public</span> {{ domain() }}</span>
        </div>
      </div>
    } @else {
      <button type="button" class="lp full" (click)="open()">
        @if (data()?.image) {
          <img class="lp-cover" [src]="data()!.image" alt="" referrerpolicy="no-referrer" />
        }
        <div class="lp-body">
          <span class="lp-domain"><span class="material-icons" aria-hidden="true">public</span> {{ domain() }}</span>
          <span class="lp-title">{{ data()?.title || 'Apri il link' }}</span>
          @if (data()?.description) { <span class="lp-desc">{{ data()!.description }}</span> }
          <span class="lp-open"><span class="material-icons" aria-hidden="true">open_in_new</span> Apri l'originale</span>
        </div>
      </button>
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
    .lp-thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 12px; flex-shrink: 0; background: var(--surface-2); }
    .lp-ph { display: flex; align-items: center; justify-content: center; color: var(--muted); }
    .lp-ph .material-icons { font-size: 26px; }

    .lp.compact { display: flex; gap: 12px; align-items: center; }
    .lp.compact .lp-meta { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .lp.compact .lp-title {
      font-size: 0.95rem;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }

    .lp.full {
      display: block; width: 100%; text-align: left; cursor: pointer;
      border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
      background: var(--surface, #fffdf9); padding: 0; font: inherit;
      margin-top: 18px;
    }
    .lp.full:hover { border-color: var(--primary); }
    .lp-cover { width: 100%; max-height: 300px; object-fit: cover; display: block; background: var(--surface-2); }
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

  open(): void {
    window.open(this.url(), '_blank', 'noopener');
  }
}
