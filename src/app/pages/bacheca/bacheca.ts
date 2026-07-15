import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Auth } from '../../services/auth';
import { ShareDraftService } from '../../services/share-draft';
import { LinkPreview } from '../../components/link-preview/link-preview';
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
  imports: [DatePipe, ReactiveFormsModule, LinkPreview],
  templateUrl: './bacheca.html',
  styleUrl: './bacheca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bacheca implements OnInit {
  private readonly api = inject(BachecaService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly shareDraft = inject(ShareDraftService);
  readonly auth = inject(Auth);

  readonly tags = BACHECA_TAGS;
  readonly tipo = bachecaTag;

  // stato condiviso dal servizio (persiste tra le navigazioni)
  readonly messaggi = this.api.messaggi;
  readonly loading = this.api.loading;
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

  // --- modifica di un proprio messaggio (solo senza risposte) ---
  readonly editingId = signal<number | null>(null);
  readonly editControl = this.fb.nonNullable.control('', Validators.maxLength(500));
  readonly editPhoto = signal<string | null>(null); // stato foto in modifica
  readonly editHasPos = signal(false); // il messaggio ha una posizione originale
  readonly editKeepPos = signal(true); // mantenere la posizione?

  readonly composing = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  private readonly mapCache = new Map<string, SafeResourceUrl>();

  // foto profilo che non si caricano (es. 403 da Google) → fallback all'iniziale
  private readonly brokenPics = signal<ReadonlySet<string>>(new Set());
  showPic(url: string | null): url is string {
    return !!url && !this.brokenPics().has(url);
  }
  picBroken(url: string | null): void {
    if (!url) return;
    this.brokenPics.update((s) => new Set(s).add(url));
  }

  // deep-link da notifica: /bacheca?msg=ID → scorre al messaggio e lo evidenzia
  private readonly pendingHighlight = signal<number | null>(null);
  readonly highlightId = signal<number | null>(null);

  private readonly highlightEffect = effect(() => {
    const id = this.pendingHighlight();
    if (id === null) return;
    if (this.messaggi().some((m) => m.id === id)) {
      this.pendingHighlight.set(null);
      this.highlightId.set(id);
      setTimeout(() => this.scrollToMsg(id), 80);
      setTimeout(() => this.highlightId.set(null), 3200);
    }
  });

  ngOnInit(): void {
    this.load();
    this.postForm.controls.testo.valueChanges.subscribe((v) => this.testoValue.set(v ?? ''));
    this.route.queryParamMap.subscribe((p) => {
      const m = p.get('msg');
      if (m) this.pendingHighlight.set(Number(m));
    });

    // Arrivo da "Condividi qui": apro il compositore già precompilato.
    const d = this.shareDraft.consume();
    if (d) {
      const parts = [d.title, d.text, d.url].map((s) => s.trim()).filter(Boolean);
      // evito di ripetere il link se è già dentro il testo
      const testo = parts
        .filter((p, i) => !(i === parts.length - 1 && p === d.url && d.text.includes(d.url)))
        .join('\n\n');
      this.postForm.controls.testo.setValue(testo);
      this.testoValue.set(testo);
      this.composing.set(true);
    }
  }

  private scrollToMsg(id: number): void {
    document.getElementById('msg-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private load(): void {
    this.api.load();
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
          this.composing.set(false);
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

  // Link condiviso nel testo del post → anteprima. Riconosce anche URL senza
  // schema (es. "share.google/...", "comune.modena.it/...") con TLD noto.
  private static readonly URL_RE =
    /(https?:\/\/[^\s]+|www\.[^\s]+|(?:[a-z0-9][a-z0-9-]*\.)+(?:com|org|net|it|eu|info|me|tv|app|io|dev|google|edu|gov)(?:\/[^\s]*)?)/i;

  firstUrl(testo: string | null): string | null {
    const m = testo?.match(Bacheca.URL_RE);
    if (!m) return null;
    const u = m[0];
    return /^https?:\/\//i.test(u) ? u : 'https://' + u;
  }

  textWithoutUrl(testo: string | null): string {
    return (testo ?? '').replace(Bacheca.URL_RE, '').trim();
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

  // --- modifica messaggio (solo autore, solo se senza risposte) ---
  canEdit(msg: MessaggioBacheca): boolean {
    return msg.isOwner && msg.risposte.length === 0;
  }

  startEdit(msg: MessaggioBacheca): void {
    this.editingId.set(msg.id);
    this.editControl.setValue(msg.testo ?? '');
    this.editPhoto.set(msg.photoUrl);
    this.editHasPos.set(msg.latitude !== null && msg.longitude !== null);
    this.editKeepPos.set(true);
    this.error.set(null);
  }

  annullaModifica(): void {
    this.editingId.set(null);
  }

  onEditPhoto(event: Event): void {
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
      this.editPhoto.set(reader.result as string);
      this.error.set(null);
    };
    reader.readAsDataURL(file);
  }

  removeEditPhoto(): void {
    this.editPhoto.set(null);
  }

  toggleEditPos(): void {
    this.editKeepPos.update((v) => !v);
  }

  salvaModifica(msg: MessaggioBacheca): void {
    const testo = this.editControl.getRawValue().trim();
    const photo = this.editPhoto();
    if (!testo && !photo) {
      this.error.set('Scrivi un messaggio o allega una foto.');
      return;
    }
    if (this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    const keepPos = this.editHasPos() && this.editKeepPos();
    const lat = keepPos ? msg.latitude : null;
    const lng = keepPos ? msg.longitude : null;
    this.api.update(msg.id, testo, msg.tag, photo, lat, lng).subscribe({
      next: () => {
        this.editingId.set(null);
        this.sending.set(false);
        this.load();
      },
      error: () => {
        this.error.set('Errore durante la modifica.');
        this.sending.set(false);
      },
    });
  }

  // --- follow (campanella) ---
  toggleFollow(msg: MessaggioBacheca): void {
    const target = !msg.isFollowing;
    const req = msg.isFollowing ? this.api.unfollow(msg.id) : this.api.follow(msg.id);
    req.subscribe({ next: () => this.api.setFollowing(msg.id, target) });
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
