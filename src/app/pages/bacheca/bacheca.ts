import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Auth } from '../../services/auth';

interface RispostaDto {
  id: number;
  userDisplayName: string;
  testo: string;
  createdAt: string;
  isOwner: boolean;
}

interface MessaggioDto {
  id: number;
  userDisplayName: string;
  testo: string;
  createdAt: string;
  isOwner: boolean;
  risposte: RispostaDto[];
}

@Component({
  selector: 'app-bacheca',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './bacheca.html',
  styleUrl: './bacheca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bacheca implements OnInit {
  private readonly http = inject(HttpClient);
  readonly auth = inject(Auth);
  private readonly fb = inject(FormBuilder);

  readonly messaggi = signal<MessaggioDto[]>([]);
  readonly rispondendoA = signal<number | null>(null);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    testo: ['', [Validators.required, Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.http.get<MessaggioDto[]>('/api/bacheca').subscribe({
      next: (items) => this.messaggi.set(items),
    });
  }

  rispondi(id: number): void {
    this.rispondendoA.set(id);
    this.form.reset();
    this.error.set(null);
  }

  annullaRisposta(): void {
    this.rispondendoA.set(null);
    this.form.reset();
    this.error.set(null);
  }

  invia(parentId: number | null = null): void {
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);

    const body = { testo: this.form.getRawValue().testo, parentId };
    this.http.post<MessaggioDto>('/api/bacheca', body).subscribe({
      next: () => {
        this.form.reset();
        this.rispondendoA.set(null);
        this.sending.set(false);
        this.load();
      },
      error: () => {
        this.error.set("Errore durante l'invio. Riprova.");
        this.sending.set(false);
      },
    });
  }

  elimina(id: number): void {
    if (!confirm('Eliminare questo messaggio?')) return;
    this.http.delete(`/api/bacheca/${id}`).subscribe({
      next: () => this.load(),
    });
  }
}
