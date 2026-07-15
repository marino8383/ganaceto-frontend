import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { ProfiloSheet } from '../profilo-sheet/profilo-sheet';
import { NotificheSheet } from '../notifiche-sheet/notifiche-sheet';
import { SwUpdate } from '@angular/service-worker';
import { Auth } from '../../services/auth';
import { Notifiche } from '../../services/notifiche';
import { InstallService } from '../../services/install';

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
  readonly install = inject(InstallService);
  private readonly swUpdate = inject(SwUpdate);

  // nuova versione dell'app pronta (mostra la barra "Aggiorna")
  readonly updateReady = signal(false);

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

  // fumetto "N utenti online ora!" al tocco del pallino
  readonly onlineTip = signal(false);
  private tipTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.tickOnline();
    const onlineTimer = setInterval(() => this.tickOnline(), 16000);

    // aggiorna il contatore notifiche al login e periodicamente
    effect(() => {
      if (this.isLogged()) this.notifiche.refreshCount();
      else this.notifiche.reset();
    });
    const notifTimer = setInterval(() => {
      if (this.isLogged()) this.notifiche.refreshCount();
    }, 30000);

    // controllo aggiornamenti PWA: segnala quando una nuova versione è pronta
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((ev) => {
        if (ev.type === 'VERSION_READY') this.updateReady.set(true);
      });
      this.swUpdate.checkForUpdate().catch(() => {});
    }

    // reattività: ricontrolla notifiche e aggiornamenti quando l'app torna in primo piano
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (this.isLogged()) this.notifiche.refreshCount();
      if (this.swUpdate.isEnabled) this.swUpdate.checkForUpdate().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    inject(DestroyRef).onDestroy(() => {
      clearInterval(onlineTimer);
      clearInterval(notifTimer);
      clearTimeout(this.tipTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    });
  }

  applyUpdate(): void {
    this.swUpdate.activateUpdate().then(() => document.location.reload());
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

  private tickOnline(): void {
    const h = new Date().getHours();
    const base = h < 7 || h >= 23 ? 0 : h < 19 ? 5 : 6;
    const target = base === 0 ? 0 : Math.max(2, base + Math.round(Math.random() * 2 - 1));
    const cur = this.online();
    this.online.set(cur < target ? cur + 1 : cur > target ? cur - 1 : cur);
  }
}
