import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { ProfiloSheet } from '../profilo-sheet/profilo-sheet';
import { Auth } from '../../services/auth';

interface Tab { path: string; label: string; icon: string; authOnly?: boolean; }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly auth = inject(Auth);

  // stato utente (reattivo)
  readonly user = this.auth.user;
  readonly isLogged = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'Admin');
  readonly initial = computed(() => (this.user()?.displayName ?? '?').charAt(0).toUpperCase());
  readonly avatar = computed(() => this.user()?.profilePicture || null);

  // navigazione — Adesioni solo per utenti registrati
  private readonly allTabs: Tab[] = [
    { path: '/notizie', label: 'Notizie', icon: '📋' },
    { path: '/casina', label: 'Casina', icon: '🏠' },
    { path: '/adesioni', label: 'Adesioni', icon: '✋', authOnly: true },
    { path: '/bacheca', label: 'Bacheca', icon: '💬' },
    { path: '/chi-siamo', label: 'Chi siamo', icon: 'ℹ️' },
  ];
  readonly tabs = computed(() => this.allTabs.filter((t) => !t.authOnly || this.isLogged()));

  // indicatore "online ora" verosimile (di notte ~0, di giorno oscilla 4-6, sera 5-7)
  readonly online = signal(4);

  // splash d'apertura
  readonly splashVisible = signal(true);

  constructor() {
    this.tickOnline();
    const onlineTimer = setInterval(() => this.tickOnline(), 16000);
    const splashTimer = setTimeout(() => this.splashVisible.set(false), 2200);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(onlineTimer);
      clearTimeout(splashTimer);
    });
  }

  openProfilo(): void {
    this.bottomSheet.open(ProfiloSheet);
  }

  hideSplash(): void {
    this.splashVisible.set(false);
  }

  private tickOnline(): void {
    const h = new Date().getHours();
    const base = h < 7 || h >= 23 ? 0 : h < 19 ? 5 : 6;
    const target = base === 0 ? 0 : Math.max(2, base + Math.round(Math.random() * 2 - 1));
    const cur = this.online();
    this.online.set(cur < target ? cur + 1 : cur > target ? cur - 1 : cur);
  }
}
