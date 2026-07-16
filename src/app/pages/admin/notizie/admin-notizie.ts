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
import { ActivatedRoute } from '@angular/router';
import { CoverSize, News, NewsItem, NewsTag, NEWS_TYPES, newsType } from '../../../services/news';
import { ShareDraftService } from '../../../services/share-draft';
import { htmlToPlain } from '../../../shared/format';

type FormMode = 'closed' | 'create' | 'edit';

// limite del file in ingresso (poi l'immagine viene ridimensionata/compressa)
const MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB
// lato lungo massimo della copertina salvata (contiene il peso del base64 nel DB)
const MAX_COVER_DIM = 1600;

@Component({
  selector: 'app-admin-notizie',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './admin-notizie.html',
  styleUrl: './admin-notizie.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:paste)': 'onPaste($event)' },
})
export class AdminNotizie implements OnInit {
  private readonly newsService = inject(News);
  private readonly fb = inject(FormBuilder);
  private readonly shareDraft = inject(ShareDraftService);
  private readonly route = inject(ActivatedRoute);

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
    body: [''], // facoltativo: testo semplice; l'app lo impagina in automatico
    tag: ['Evento' as NewsTag, Validators.required],
    isVisible: [true],
    expandedInHome: [false],
    referenceDate: [''],
    startTime: [''],
    endTime: [''],
    atCasina: [false],
    coverSize: ['medium' as CoverSize],
    externalUrl: [''],
  });

  ngOnInit(): void {
    this.newsService.loadAdminNotizie();

    // Arrivo da "Modifica" nel dettaglio: /admin/notizie?edit=<id>
    const editId = Number(this.route.snapshot.queryParamMap.get('edit'));
    if (editId) {
      this.newsService.getById(editId).subscribe({ next: (item) => this.openEdit(item) });
      return;
    }

    // Arrivo da "Condividi qui": apro la creazione già precompilata.
    const d = this.shareDraft.consume();
    if (d) {
      this.openCreate();
      // Da condivisione: tipo "News", testo lasciato vuoto (facoltativo).
      this.form.patchValue({
        tag: 'News',
        title: d.title || 'Dal web',
        externalUrl: d.url || '',
      });
    }
  }

  openCreate(): void {
    this.form.reset({
      title: '', body: '', tag: 'Evento', isVisible: true, expandedInHome: false,
      referenceDate: '', startTime: '', endTime: '', atCasina: false, coverSize: 'medium', externalUrl: '',
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
      atCasina: item.atCasina,
      coverSize: item.coverSize ?? 'medium',
      externalUrl: item.externalUrl ?? '',
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
    input.value = ''; // consente di ricaricare lo stesso file
    if (file) void this.fileToCover(file);
  }

  // Incolla un'immagine dagli appunti (Ctrl/Cmd+V) mentre il form è aperto.
  onPaste(event: ClipboardEvent): void {
    if (this.formMode() === 'closed') return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) {
          event.preventDefault();
          void this.fileToCover(file);
        }
        return;
      }
    }
  }

  // Pulsante "Incolla": legge gli appunti (Chrome/Edge desktop). Fallback: Ctrl+V.
  async pasteFromClipboard(): Promise<void> {
    if (!navigator.clipboard?.read) {
      this.error.set('Usa Ctrl+V per incollare l’immagine.');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          void this.fileToCover(new File([blob], 'incolla.png', { type }));
          return;
        }
      }
      this.error.set('Negli appunti non c’è un’immagine.');
    } catch {
      this.error.set('Permesso appunti negato: prova con Ctrl+V.');
    }
  }

  private async fileToCover(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      this.error.set('Il file incollato non è un’immagine.');
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      this.error.set('Immagine troppo grande.');
      return;
    }
    try {
      this.cover.set(await this.compressImage(file));
      this.error.set(null);
    } catch {
      this.error.set('Impossibile leggere l’immagine.');
    }
  }

  // Ridimensiona (lato lungo ≤ 1600px) e comprime in JPEG: gli screenshot grandi
  // entrano senza appesantire il DB (le copertine sono salvate come data URL).
  private compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_COVER_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject();
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject();
      };
      img.src = url;
    });
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
      atCasina: raw.atCasina && !!raw.referenceDate,
      coverSize: raw.coverSize,
      externalUrl: raw.externalUrl.trim() || null,
    };

    this.saving.set(true);
    this.error.set(null);

    const done = () => {
      this.newsService.loadAdminNotizie();
      this.formMode.set('closed');
      this.saving.set(false);
    };
    const fail = (err: unknown) => {
      // 409 = conflitto calendario Casina: mostra il messaggio del server
      const msg = (err as { status?: number; error?: unknown })?.status === 409
        ? String((err as { error?: unknown }).error)
        : 'Errore durante il salvataggio.';
      this.error.set(msg);
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
        atCasina: item.atCasina,
        coverSize: item.coverSize,
        externalUrl: item.externalUrl,
      })
      .subscribe({ next: () => this.newsService.loadAdminNotizie() });
  }
}
