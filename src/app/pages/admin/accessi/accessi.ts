import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Admin, AccessOverview } from '../../../services/admin';

@Component({
  selector: 'app-admin-accessi',
  imports: [DatePipe, RouterLink],
  templateUrl: './accessi.html',
  styleUrl: './accessi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAccessi implements OnInit {
  private readonly admin = inject(Admin);

  readonly data = signal<AccessOverview | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.admin.getAccess().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
