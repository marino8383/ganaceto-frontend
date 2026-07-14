import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { ProfiloSheet } from '../profilo-sheet/profilo-sheet';
import { NotificheSheet } from '../notifiche-sheet/notifiche-sheet';
import { Auth } from '../../services/auth';
import { Notifiche } from '../../services/notifiche';

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
  private readonly notifiche = inject(Notifiche);

  // stato utente (reattivo)
  readonly user = this.auth.user;
  readonly isLogged = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'Admin');
  readonly initial = computed(() => (this.user()?.displayName ?? '?').charAt(0).toUpperCase());
  readonly avatar = computed(() => this.user()?.profilePicture || null);

  // notifiche (campanello)
  readonly unread = this.notifiche.unread;

  // navigazione — Adesioni solo per utenti registrati
  private readonly allTabs: Tab[] = [
    { path: '/notizie', label: 'Notizie', icon: 'campaign' },
    { path: '/casina', label: 'Casina', icon: 'home' },
    { path: '/adesioni', label: 'Adesioni', icon: 'how_to_reg', authOnly: true },
    { path: '/bacheca', label: 'Bacheca', icon: 'forum' },
    { path: '/chi-siamo', label: 'Chi siamo', icon: 'info' },
  ];
  readonly tabs = computed(() => this.allTabs.filter((t) => !t.authOnly || this.isLogged()));

  // indicatore "online ora" verosimile (di notte ~0, di giorno oscilla 4-6, sera 5-7)
  readonly online = signal(4);

  // splash d'apertura: solo la prima volta della sessione (niente splash ai refresh)
  readonly splashVisible = signal(!sessionStorage.getItem('ganaceto_splash'));

  // fumetto "N utenti online ora!" al tocco del pallino
  readonly onlineTip = signal(false);
  private tipTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.tickOnline();
    const onlineTimer = setInterval(() => this.tickOnline(), 16000);
    let splashTimer: ReturnType<typeof setTimeout> | undefined;
    if (this.splashVisible()) {
      sessionStorage.setItem('ganaceto_splash', '1');
      splashTimer = setTimeout(() => this.splashVisible.set(false), 1400);
    }

    // aggiorna il contatore notifiche al login e periodicamente
    effect(() => {
      if (this.isLogged()) this.notifiche.refreshCount();
      else this.notifiche.reset();
    });
    const notifTimer = setInterval(() => {
      if (this.isLogged()) this.notifiche.refreshCount();
    }, 30000);

    // reattività: ricontrolla le notifiche appena l'app torna in primo piano
    const onVisible = () => {
      if (document.visibilityState === 'visible' && this.isLogged()) {
        this.notifiche.refreshCount();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    inject(DestroyRef).onDestroy(() => {
      clearInterval(onlineTimer);
      clearInterval(notifTimer);
      clearTimeout(splashTimer);
      clearTimeout(this.tipTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    });
  }

  toggleOnlineTip(): void {
    this.onlineTip.update((v) => !v);
    clearTimeout(this.tipTimer);
    if (this.onlineTip()) {
      this.tipTimer = setTimeout(() => this.onlineTip.set(false), 2600);
    }
  }

  openProfilo(): void {
    this.bottomSheet.open(ProfiloSheet);
  }

  openNotifiche(): void {
    this.bottomSheet.open(NotificheSheet);
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
