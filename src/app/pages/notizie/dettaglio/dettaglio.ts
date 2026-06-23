import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { News, NewsItem } from '../../../services/news';

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

  readonly notizia = signal<NewsItem | null>(null);
  readonly errore = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.newsService.getById(id).subscribe({
      next: (item) => this.notizia.set(item),
      error: () => this.errore.set(true),
    });
  }
}
