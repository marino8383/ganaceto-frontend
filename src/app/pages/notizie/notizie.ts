import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { News } from '../../services/news';

@Component({
  selector: 'app-notizie',
  imports: [DatePipe, RouterLink],
  templateUrl: './notizie.html',
  styleUrl: './notizie.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notizie implements OnInit {
  private readonly newsService = inject(News);
  readonly notizie = this.newsService.notizie;

  ngOnInit(): void {
    this.newsService.loadNotizie();
  }
}
