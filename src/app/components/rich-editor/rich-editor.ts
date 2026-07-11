import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

// immagini inline nel corpo: stesso limite della copertina
const MAX_IMG_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Editor di testo ricco (contenteditable) con toolbar B/I/U, elenchi, rientri
 * e inserimento immagini inline — fedele all'editor del mockup.
 * Il valore è l'HTML del contenuto, esposto come model() bidirezionale.
 */
@Component({
  selector: 'app-rich-editor',
  templateUrl: './rich-editor.html',
  styleUrl: './rich-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichEditor {
  /** HTML del contenuto (two-way) */
  readonly value = model<string>('');
  readonly ariaLabel = input('Contenuto');
  readonly placeholder = input('Scrivi qui il contenuto…');

  /** immagine attualmente selezionata nell'editor (per ridimensionarla) */
  readonly selectedImg = signal<HTMLImageElement | null>(null);

  private readonly editor = viewChild<ElementRef<HTMLDivElement>>('editor');

  constructor() {
    // Allinea il DOM quando il valore arriva dall'esterno (apertura/modifica).
    // Durante la digitazione value === innerHTML, quindi non tocca il cursore.
    effect(() => {
      const v = this.value();
      const ref = this.editor();
      if (!ref) return;
      if (ref.nativeElement.innerHTML !== v) ref.nativeElement.innerHTML = v;
    });
  }

  onInput(): void {
    const el = this.editor()?.nativeElement;
    if (el) this.value.set(el.innerHTML);
  }

  cmd(command: string): void {
    document.execCommand(command, false);
    this.editor()?.nativeElement.focus();
    this.onInput();
  }

  // Click nell'editor: se cade su un'immagine la seleziona (per ridimensionarla),
  // altrimenti azzera la selezione.
  onEditorClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    this.selectedImg.set(target instanceof HTMLImageElement ? target : null);
  }

  // Imposta la larghezza dell'immagine selezionata (centrata).
  sizeImg(width: string): void {
    const img = this.selectedImg();
    if (!img) return;
    img.style.width = width;
    img.style.display = 'block';
    img.style.margin = '8px auto';
    this.onInput();
  }

  removeSelectedImg(): void {
    const img = this.selectedImg();
    if (!img) return;
    img.remove();
    this.selectedImg.set(null);
    this.onInput();
  }

  insertImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMG_BYTES) {
      alert('Immagine troppo grande (max 2 MB).');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const el = this.editor()?.nativeElement;
      if (el) {
        el.focus();
        // dimensione iniziale "media" e centrata; l'admin può poi ridimensionarla
        document.execCommand(
          'insertHTML',
          false,
          `<img src="${reader.result}" style="width:55%;display:block;margin:8px auto;border-radius:8px" alt="" />`,
        );
        // seleziona l'immagine appena inserita così compaiono subito i comandi dimensione
        const imgs = el.querySelectorAll('img');
        this.selectedImg.set(imgs.length ? (imgs[imgs.length - 1] as HTMLImageElement) : null);
        this.onInput();
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }
}
