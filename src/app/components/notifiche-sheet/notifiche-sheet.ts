import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Notifiche, Notifica, NotificaKind } from '../../services/notifiche';

const ICON: Record<NotificaKind, string> = {
  Generic: '🔔',
  News: '🗓️',
  Booking: '🏠',
  Adesione: '✋',
  Bacheca: '💬',
  Sondaggio: '🗳️',
};

@Component({
  selector: 'app-notifiche-sheet',
  imports: [DatePipe],
  templateUrl: './notifiche-sheet.html',
  styleUrl: './notifiche-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificheSheet implements OnInit {
  private readonly ref = inject(MatBottomSheetRef<NotificheSheet>);
  private readonly router = inject(Router);
  readonly notifiche = inject(Notifiche);

  ngOnInit(): void {
    this.notifiche.openAndRead();
  }

  icon(kind: NotificaKind): string {
    return ICON[kind] ?? '🔔';
  }

  apri(n: Notifica): void {
    this.ref.dismiss();
    if (n.link) this.router.navigateByUrl(n.link);
  }

  elimina(n: Notifica, event: Event): void {
    event.stopPropagation();
    this.notifiche.remove(n.id);
  }

  svuota(): void {
    this.notifiche.clearAll();
  }

  chiudi(): void {
    this.ref.dismiss();
  }
}
