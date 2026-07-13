import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Auth } from '../../services/auth';
import {
  BachecaService,
  BachecaTag,
  BACHECA_TAGS,
  bachecaTag,
  detectTag,
  MessaggioBacheca,
} from '../../services/bacheca';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

@Component({
  selector: 'app-bacheca',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './bacheca.html',
  styleUrl: './bacheca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bacheca implements OnInit {
  private readonly api = inject(BachecaService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  readonly auth = inject(Auth);

  readonly tags = BACHECA_TAGS;
  readonly tipo = bachecaTag;

  readonly messaggi = signal<MessaggioBacheca[]>([]);
  readonly filter = signal<BachecaTag | 'all'>('all');
  readonly filtered = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.messaggi() : this.messaggi().filter((m) => m.tag === f);
  });

  // --- nuovo messaggio ---
  readonly postForm = this.fb.nonNullable.group({
    testo: ['', Validators.maxLength(500)],
  });
  readonly manualTag = signal<BachecaTag | null>(null);
  readonly testoValue = signal('');
  readonly autoTag = computed(() => detectTag(this.testoValue()));
  readonly effectiveTag = computed(() => this.manualTag() ?? this.autoTag());
  readonly photo = signal<string | null>(null);
  readonly wantPos = signal(false);
  readonly posLoading = signal(false);

  // --- risposta ---
  readonly rispondendoA = signal<number | null>(null);
  readonly replyForm = this.fb.nonNullable.group({
    testo: ['', [Validators.required, Validators.maxLength(500)]],
  });

  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  private readonly mapCache = new Map<string, SafeResourceUrl>();

  ngOnInit(): void {
    this.load();
    this.postForm.controls.testo.valueChanges.subscribe((v) => this.testoValue.set(v ?? ''));
  }

  private load(): void {
    this.api.getAll().subscribe({ next: (items) => this.messaggi.set(items) });
  }

  setFilter(f: BachecaTag | 'all'): void {
    this.filter.set(f);
  }

  // tag: click = seleziona; ri-click sullo stesso = torna ad automatico
  selectTag(t: BachecaTag): void {
    this.manualTag.set(this.manualTag() === t ? null : t);
  }

  onPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      this.error.set('Immagine troppo grande (max 2 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.photo.set(reader.result as string);
      this.error.set(null);
    };
    reader.readAsDataURL(file);
  }

  clearPhoto(): void {
    this.photo.set(null);
  }

  togglePos(): void {
    this.wantPos.set(!this.wantPos());
  }

  pubblica(): void {
    const testo = this.postForm.getRawValue().testo.trim();
    if (!testo && !this.photo()) {
      this.error.set('Scrivi un messaggio o allega una foto.');
      return;
    }
    if (this.sending()) return;

    if (this.wantPos() && navigator.geolocation) {
      this.posLoading.set(true);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          this.posLoading.set(false);
          this.send(testo, p.coords.latitude, p.coords.longitude);
        },
        () => {
          this.posLoading.set(false);
          this.error.set('Posizione non disponibile: pubblico senza posizione.');
          this.send(testo, null, null);
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    } else {
      this.send(testo, null, null);
    }
  }

  private send(testo: string, lat: number | null, lng: number | null): void {
    this.sending.set(true);
    this.error.set(null);
    this.api
      .create({
        testo: testo || null,
        tag: this.effectiveTag(),
        photoUrl: this.photo(),
        latitude: lat,
        longitude: lng,
        parentId: null,
      })
      .subscribe({
        next: () => {
          this.postForm.reset({ testo: '' });
          this.testoValue.set('');
          this.manualTag.set(null);
          this.photo.set(null);
          this.wantPos.set(false);
          this.sending.set(false);
          this.load();
        },
        error: () => {
          this.error.set("Errore durante l'invio. Riprova.");
          this.sending.set(false);
        },
      });
  }

  // --- risposte ---
  rispondi(id: number): void {
    this.rispondendoA.set(id);
    this.replyForm.reset({ testo: '' });
    this.error.set(null);
  }

  annullaRisposta(): void {
    this.rispondendoA.set(null);
    this.replyForm.reset({ testo: '' });
  }

  inviaRisposta(parentId: number): void {
    if (this.replyForm.invalid || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.api
      .create({
        testo: this.replyForm.getRawValue().testo.trim(),
        tag: 'Info',
        photoUrl: null,
        latitude: null,
        longitude: null,
        parentId,
      })
      .subscribe({
        next: () => {
          this.rispondendoA.set(null);
          this.replyForm.reset({ testo: '' });
          this.sending.set(false);
          this.load();
        },
        error: () => {
          this.error.set("Errore durante l'invio. Riprova.");
          this.sending.set(false);
        },
      });
  }

  canDelete(item: { isOwner: boolean }): boolean {
    return item.isOwner || this.auth.isAdmin;
  }

  elimina(msg: MessaggioBacheca): void {
    const q = msg.risposte.length
      ? `Eliminare il messaggio e le ${msg.risposte.length} risposte?`
      : 'Eliminare il messaggio?';
    if (!confirm(q)) return;
    this.api.delete(msg.id).subscribe({ next: () => this.load() });
  }

  eliminaRisposta(id: number): void {
    if (!confirm('Eliminare la risposta?')) return;
    this.api.delete(id).subscribe({ next: () => this.load() });
  }

  // --- follow (campanella) ---
  toggleFollow(msg: MessaggioBacheca): void {
    const req = msg.isFollowing ? this.api.unfollow(msg.id) : this.api.follow(msg.id);
    req.subscribe({
      next: () =>
        this.messaggi.update((list) =>
          list.map((m) => (m.id === msg.id ? { ...m, isFollowing: !m.isFollowing } : m)),
        ),
    });
  }

  // --- mini-mappa posizione ---
  mapUrl(lat: number, lng: number): SafeResourceUrl {
    const key = `${lat},${lng}`;
    let url = this.mapCache.get(key);
    if (!url) {
      const bbox = `${(lng - 0.006).toFixed(5)}%2C${(lat - 0.004).toFixed(5)}%2C${(lng + 0.006).toFixed(5)}%2C${(lat + 0.004).toFixed(5)}`;
      const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
      url = this.sanitizer.bypassSecurityTrustResourceUrl(src);
      this.mapCache.set(key, url);
    }
    return url;
  }

  mapsLink(lat: number, lng: number): string {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
}
