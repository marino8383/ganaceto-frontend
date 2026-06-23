import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { News, NewsItem, NewsTag } from '../../../services/news';

type FormMode = 'closed' | 'create' | 'edit';

@Component({
  selector: 'app-admin-notizie',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './admin-notizie.html',
  styleUrl: './admin-notizie.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNotizie implements OnInit {
  private readonly newsService = inject(News);
  private readonly fb = inject(FormBuilder);

  readonly notizie = this.newsService.adminNotizie;
  readonly formMode = signal<FormMode>('closed');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly tags: NewsTag[] = ['Avviso', 'Evento', 'Info', 'Comune'];

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    body: ['', Validators.required],
    coverImageUrl: ['', Validators.pattern(/^(https?:\/\/.+)?$/)],
    tag: ['Info' as NewsTag, Validators.required],
    isVisible: [true],
  });

  ngOnInit(): void {
    this.newsService.loadAdminNotizie();
  }

  openCreate(): void {
    this.form.reset({ title: '', body: '', coverImageUrl: '', tag: 'Info', isVisible: true });
    this.editingId.set(null);
    this.formMode.set('create');
    this.error.set(null);
  }

  openEdit(item: NewsItem): void {
    this.form.setValue({
      title: item.title,
      body: item.body,
      coverImageUrl: item.coverImageUrl ?? '',
      tag: item.tag,
      isVisible: item.isVisible,
    });
    this.editingId.set(item.id);
    this.formMode.set('edit');
    this.error.set(null);
  }

  closeForm(): void {
    this.formMode.set('closed');
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;

    const raw = this.form.getRawValue();
    const dto = {
      title: raw.title,
      body: raw.body,
      coverImageUrl: raw.coverImageUrl || null,
      tag: raw.tag,
    };

    this.saving.set(true);
    this.error.set(null);

    const mode = this.formMode();

    if (mode === 'create') {
      this.newsService.create(dto).subscribe({
        next: () => {
          this.newsService.loadAdminNotizie();
          this.formMode.set('closed');
          this.saving.set(false);
        },
        error: () => {
          this.error.set('Errore durante il salvataggio.');
          this.saving.set(false);
        },
      });
    } else {
      const id = this.editingId()!;
      this.newsService.update(id, { ...dto, isVisible: raw.isVisible }).subscribe({
        next: () => {
          this.newsService.loadAdminNotizie();
          this.formMode.set('closed');
          this.saving.set(false);
        },
        error: () => {
          this.error.set('Errore durante il salvataggio.');
          this.saving.set(false);
        },
      });
    }
  }

  delete(item: NewsItem): void {
    if (!confirm(`Eliminare "${item.title}"?`)) return;
    this.newsService.delete(item.id).subscribe({
      next: () => this.newsService.loadAdminNotizie(),
    });
  }

  toggleVisibility(item: NewsItem): void {
    this.newsService
      .update(item.id, {
        title: item.title,
        body: item.body,
        coverImageUrl: item.coverImageUrl,
        tag: item.tag,
        isVisible: !item.isVisible,
      })
      .subscribe({ next: () => this.newsService.loadAdminNotizie() });
  }
}
