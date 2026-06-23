import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { ProfiloSheet } from '../profilo-sheet/profilo-sheet';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly bottomSheet = inject(MatBottomSheet);

  tabs = [
    { path: '/notizie', label: 'Notizie', icon: '📋' },
    { path: '/casina', label: 'Casina', icon: '🏠' },
    { path: '/adesioni', label: 'Adesioni', icon: '✋' },
    { path: '/bacheca', label: 'Bacheca', icon: '💬' },
    { path: '/chi-siamo', label: 'Chi siamo', icon: 'ℹ️' },
  ];

  openProfilo() {
    this.bottomSheet.open(ProfiloSheet);
  }
}
