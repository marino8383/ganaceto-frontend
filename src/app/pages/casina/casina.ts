import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../services/auth';
import {
  CalendarBooking,
  CasinaService,
  MyBooking,
  PendingBooking,
} from '../../services/casina';

interface DayCell {
  key: string; // 'yyyy-MM-dd'
  day: number;
  inMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  bookable: boolean; // regola weekend + non passato + nessun privato quel giorno
  bookings: CalendarBooking[]; // eventi della giornata (i pubblici possono essere più di uno)
  kind: 'free' | 'private' | 'privatePending' | 'public';
  label: string | null; // titolo, "Occupato" o "N eventi"
  mine: boolean;
}

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-casina',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './casina.html',
  styleUrl: './casina.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Casina implements OnInit {
  private readonly api = inject(CasinaService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(Auth);

  readonly weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  // orari proposti a quarti d'ora (07:00 → 23:45)
  readonly timeOptions: string[] = Array.from({ length: 17 * 4 }, (_, i) => {
    const h = 7 + Math.floor(i / 4);
    const m = (i % 4) * 15;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });

  // mese visualizzato
  private readonly today = new Date();
  readonly cursor = signal<{ y: number; m: number }>({
    y: this.today.getFullYear(),
    m: this.today.getMonth(),
  });
  readonly monthLabel = computed(() => `${MONTHS[this.cursor().m]} ${this.cursor().y}`);

  readonly bookings = signal<CalendarBooking[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly mode = this.api.mode;

  // prenotazioni per giorno: un privato al massimo, pubblici anche più di uno
  private readonly byDay = computed(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of this.bookings()) {
      const k = dayKey(new Date(b.slotStart));
      const list = map.get(k) ?? [];
      list.push(b);
      map.set(k, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
    return map;
  });

  readonly cells = computed<DayCell[]>(() => {
    const { y, m } = this.cursor();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // settimana che parte dal lunedì
    const start = new Date(y, m, 1 - offset);
    const todayKey = dayKey(this.today);
    const map = this.byDay();
    const weekendOnly = this.mode() === 'weekend';

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = dayKey(d);
      const isPast = key < todayKey;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const list = map.get(key) ?? [];
      const priv = list.find((b) => b.type === 'Private');
      cells.push({
        key,
        day: d.getDate(),
        inMonth: d.getMonth() === m,
        isPast,
        isToday: key === todayKey,
        // gli eventi pubblici non "consumano" la giornata: si può ancora chiedere
        // (il server rifiuta solo se gli orari si sovrappongono)
        bookable: !isPast && !priv && (!weekendOnly || isWeekend),
        bookings: list,
        kind: priv
          ? (priv.status === 'Pending' ? 'privatePending' : 'private')
          : list.length > 0 ? 'public' : 'free',
        label:
          list.length === 0 ? null
          : list.length === 1 ? (list[0].title ?? 'Occupato')
          : `${list.length} eventi`,
        mine: list.some((b) => b.isMine),
      });
    }
    return cells;
  });

  // prossimi eventi pubblici (lista "In programma")
  readonly upcoming = signal<CalendarBooking[]>([]);

  // giorno selezionato (dettaglio o form di prenotazione)
  readonly selected = signal<DayCell | null>(null);

  // --- form richiesta prenotazione ---
  readonly bookForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    from: ['09:00', Validators.required],
    to: ['13:00', Validators.required],
    phone: ['', [Validators.required, Validators.maxLength(30)]],
    notes: ['', Validators.maxLength(300)],
  });
  readonly sending = signal(false);

  // --- le mie prenotazioni ---
  readonly mine = signal<MyBooking[]>([]);

  // --- admin ---
  readonly pending = signal<PendingBooking[]>([]);
  readonly adminFormOpen = signal(false);
  readonly adminForm = this.fb.nonNullable.group({
    date: ['', Validators.required],
    from: ['09:00', Validators.required],
    to: ['12:00', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(80)]],
    isPublic: [true],
    repeatWeeks: [1, [Validators.min(1), Validators.max(52)]],
  });

  ngOnInit(): void {
    this.api.loadConfig();
    this.loadMonth();
    this.loadUpcoming();
    if (this.auth.isLoggedIn) this.loadMine();
    if (this.auth.isAdmin) this.loadPending();
  }

  // prossimi eventi pubblici nei 60 giorni (mostra le attività ricorrenti)
  loadUpcoming(): void {
    const from = dayKey(this.today);
    const to = dayKey(new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate() + 60));
    this.api.calendar(from, to).subscribe({
      next: (items) =>
        this.upcoming.set(
          items
            .filter((b) => b.type === 'Public' && b.status === 'Confirmed')
            .slice(0, 8),
        ),
    });
  }

  // --- calendario ---
  prevMonth(): void { this.shiftMonth(-1); }
  nextMonth(): void { this.shiftMonth(1); }

  private shiftMonth(delta: number): void {
    const { y, m } = this.cursor();
    const d = new Date(y, m + delta, 1);
    this.cursor.set({ y: d.getFullYear(), m: d.getMonth() });
    this.selected.set(null);
    this.loadMonth();
  }

  loadMonth(): void {
    const { y, m } = this.cursor();
    // la griglia mostra anche code dei mesi adiacenti: carico con margine
    const from = dayKey(new Date(y, m, -6));
    const to = dayKey(new Date(y, m + 1, 13));
    this.loading.set(true);
    this.api.calendar(from, to).subscribe({
      next: (items) => { this.bookings.set(items); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Impossibile caricare il calendario.'); },
    });
  }

  selectDay(cell: DayCell): void {
    this.error.set(null);
    this.success.set(null);
    if (!cell.inMonth) return;
    if (this.selected()?.key === cell.key) { this.selected.set(null); return; }
    this.selected.set(cell);
  }

  // --- richiesta prenotazione ---
  invia(): void {
    const cell = this.selected();
    if (!cell || this.bookForm.invalid || this.sending()) return;
    const v = this.bookForm.getRawValue();
    const start = new Date(`${cell.key}T${v.from}:00`);
    const end = new Date(`${cell.key}T${v.to}:00`);
    if (end <= start) { this.error.set("L'orario di fine deve essere dopo l'inizio."); return; }

    this.sending.set(true);
    this.error.set(null);
    this.api
      .create({
        slotStart: start.toISOString(),
        slotEnd: end.toISOString(),
        title: v.title.trim(),
        phone: v.phone.trim(),
        notes: v.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.selected.set(null);
          this.bookForm.patchValue({ title: '', notes: '' });
          this.success.set(
            this.auth.isAdmin
              ? 'Prenotazione inserita e confermata.'
              : 'Richiesta inviata! Riceverai una notifica appena l’associazione risponde.',
          );
          this.loadMonth();
          this.loadMine();
        },
        error: (err) => {
          this.sending.set(false);
          this.error.set(typeof err?.error === 'string' && err.error
            ? err.error
            : 'Invio non riuscito. Riprova.');
        },
      });
  }

  // --- le mie prenotazioni ---
  loadMine(): void {
    this.api.mine().subscribe({ next: (items) => this.mine.set(items) });
  }

  annulla(b: MyBooking): void {
    if (!confirm(`Annullare "${b.title}"?`)) return;
    this.api.cancel(b.id).subscribe({
      next: () => { this.loadMine(); this.loadMonth(); },
      error: (err) => this.error.set(typeof err?.error === 'string' && err.error
        ? err.error
        : 'Annullamento non riuscito.'),
    });
  }

  // "10:00–13:00", "dalle 20:00" (senza fine) o "tutto il giorno"
  // (gli eventi-notizia senza fascia oraria coprono 00:00–23:59)
  slotLabel(b: { slotStart: string; slotEnd: string }): string {
    const s = new Date(b.slotStart);
    const e = new Date(b.slotEnd);
    const openStart = s.getHours() === 0 && s.getMinutes() === 0;
    const openEnd = e.getHours() === 23 && e.getMinutes() === 59;
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (openStart && openEnd) return 'tutto il giorno';
    if (openEnd) return `dalle ${fmt(s)}`;
    return `${fmt(s)}–${fmt(e)}`;
  }

  statusLabel(s: MyBooking['status']): string {
    switch (s) {
      case 'Pending': return 'In attesa';
      case 'Confirmed': return 'Confermata';
      case 'Rejected': return 'Non accolta';
      case 'CancelledByUser': return 'Annullata';
      default: return s;
    }
  }

  // --- admin ---
  loadPending(): void {
    this.api.pending().subscribe({ next: (items) => this.pending.set(items) });
  }

  approva(p: PendingBooking): void {
    this.api.decide(p.id, true, null).subscribe({
      next: () => { this.loadPending(); this.loadMonth(); },
      error: (err) => this.error.set(typeof err?.error === 'string' && err.error
        ? err.error
        : 'Operazione non riuscita.'),
    });
  }

  rifiuta(p: PendingBooking): void {
    const reason = prompt('Motivo del rifiuto (facoltativo):');
    if (reason === null) return; // annullato
    this.api.decide(p.id, false, reason.trim() || null).subscribe({
      next: () => { this.loadPending(); this.loadMonth(); },
      error: () => this.error.set('Operazione non riuscita.'),
    });
  }

  adminInvia(): void {
    if (this.adminForm.invalid || this.sending()) return;
    const v = this.adminForm.getRawValue();
    const start = new Date(`${v.date}T${v.from}:00`);
    const end = new Date(`${v.date}T${v.to}:00`);
    if (end <= start) { this.error.set("L'orario di fine deve essere dopo l'inizio."); return; }

    this.sending.set(true);
    this.api
      .adminCreate({
        slotStart: start.toISOString(),
        slotEnd: end.toISOString(),
        title: v.title.trim(),
        isPublic: v.isPublic,
        repeatWeeks: v.repeatWeeks,
      })
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          this.adminFormOpen.set(false);
          this.adminForm.patchValue({ title: '' });
          this.success.set(
            r.skipped.length
              ? `Create ${r.created} date; saltate perché occupate: ${r.skipped.join(', ')}.`
              : `Create ${r.created} date.`,
          );
          this.loadMonth();
          this.loadUpcoming();
        },
        error: () => { this.sending.set(false); this.error.set('Inserimento non riuscito.'); },
      });
  }

  elimina(b: CalendarBooking): void {
    const series = confirm(
      'Eliminare questa prenotazione?\n(OK = solo questa; se fa parte di una serie potrai eliminare tutta la serie dopo)',
    );
    if (!series) return;
    this.api.delete(b.id, false).subscribe({
      next: () => { this.selected.set(null); this.loadMonth(); this.loadUpcoming(); },
      error: () => this.error.set('Eliminazione non riuscita.'),
    });
  }

  toggleMode(): void {
    const next = this.mode() === 'weekend' ? 'all' : 'weekend';
    this.api.setConfig(next).subscribe({
      next: () => this.api.mode.set(next),
      error: () => this.error.set('Impossibile cambiare la modalità.'),
    });
  }
}
