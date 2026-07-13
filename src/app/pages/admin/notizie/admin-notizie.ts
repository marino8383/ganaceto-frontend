import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { News, NewsItem, NewsTag, NEWS_TYPES, newsType } from '../../../services/news';
import { htmlToPlain } from '../../../shared/format';

type FormMode = 'closed' | 'create' | 'edit';

// dimensione massima copertina caricata da dispositivo (evita payload enormi in DB)
const MAX_COVER_BYTES = 2 * 1024 * 1024; // 2 MB

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

  // anteprima copertina (data URL o http URL)
  readonly cover = signal<string | null>(null);

  private readonly bodyRef = viewChild<ElementRef<HTMLTextAreaElement>>('bodyArea');

  // Avvolge la selezione con i marcatori (**grassetto**, _corsivo_).
  wrap(marker: string): void {
    const ta = this.bodyRef()?.nativeElement;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;
    const sel = val.slice(start, end) || 'testo';
    const next = val.slice(0, start) + marker + sel + marker + val.slice(end);
    this.form.controls.body.setValue(next);
    queueMicrotask(() => {
      ta.focus();
      ta.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  }

  readonly newsTypes = NEWS_TYPES;
  readonly tipo = newsType;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    body: ['', Validators.required], // testo semplice; l'app lo impagina in automatico
    tag: ['Evento' as NewsTag, Validators.required],
    isVisible: [true],
    expandedInHome: [false],
    referenceDate: [''],
    startTime: [''],
    endTime: [''],
  });

  ngOnInit(): void {
    this.newsService.loadAdminNotizie();
  }

  openCreate(): void {
    this.form.reset({
      title: '', body: '', tag: 'Evento', isVisible: true, expandedInHome: false,
      referenceDate: '', startTime: '', endTime: '',
    });
    this.cover.set(null);
    this.editingId.set(null);
    this.formMode.set('create');
    this.error.set(null);
  }

  openEdit(item: NewsItem): void {
    this.form.setValue({
      title: item.title,
      body: htmlToPlain(item.body), // notizie vecchie (HTML) → testo semplice modificabile
      tag: item.tag,
      isVisible: item.isVisible,
      expandedInHome: item.expandedInHome,
      referenceDate: item.referenceDate ?? '',
      startTime: item.startTime ?? '',
      endTime: item.endTime ?? '',
    });
    this.cover.set(item.coverImageUrl);
    this.editingId.set(item.id);
    this.formMode.set('edit');
    this.error.set(null);
  }

  closeForm(): void {
    this.formMode.set('closed');
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_COVER_BYTES) {
      this.error.set('Immagine troppo grande (max 2 MB).');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.cover.set(reader.result as string);
      this.error.set(null);
    };
    reader.readAsDataURL(file);
    input.value = ''; // consente di ricaricare lo stesso file
  }

  removeCover(): void {
    this.cover.set(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;

    const raw = this.form.getRawValue();
    const dto = {
      title: raw.title,
      body: raw.body.trim(),
      coverImageUrl: this.cover(),
      tag: raw.tag,
      expandedInHome: raw.expandedInHome,
      referenceDate: raw.referenceDate || null,
      startTime: raw.startTime || null,
      endTime: raw.endTime || null,
    };

    this.saving.set(true);
    this.error.set(null);

    const done = () => {
      this.newsService.loadAdminNotizie();
      this.formMode.set('closed');
      this.saving.set(false);
    };
    const fail = () => {
      this.error.set('Errore durante il salvataggio.');
      this.saving.set(false);
    };

    if (this.formMode() === 'create') {
      this.newsService.create(dto).subscribe({ next: done, error: fail });
    } else {
      const id = this.editingId()!;
      this.newsService.update(id, { ...dto, isVisible: raw.isVisible }).subscribe({ next: done, error: fail });
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
        expandedInHome: item.expandedInHome,
        referenceDate: item.referenceDate,
        startTime: item.startTime,
        endTime: item.endTime,
      })
      .subscribe({ next: () => this.newsService.loadAdminNotizie() });
  }
}
