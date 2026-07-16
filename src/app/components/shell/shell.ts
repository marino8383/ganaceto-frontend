import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { ProfiloSheet } from '../profilo-sheet/profilo-sheet';
import { NotificheSheet } from '../notifiche-sheet/notifiche-sheet';
import { SwUpdate } from '@angular/service-worker';
import { Auth } from '../../services/auth';
import { Notifiche } from '../../services/notifiche';
import { InstallService } from '../../services/install';
import { Push } from '../../services/push';

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
  readonly push = inject(Push);
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

  // Pallino "online ora" = max(utenti REALI, quota "ambientale"). La quota fa da
  // pavimento vivace per fascia oraria (bassa di giorno, 0 di notte) così non
  // sembra deserto nei primi tempi; quando i reali bastano, prevalgono loro.
  // NB: la dashboard admin /admin/accessi mostra sempre i numeri reali.
  private readonly ambient = signal(0);
  readonly online = computed(() => Math.max(this.auth.online(), this.ambient()));

  // fumetto "N utenti online ora!" al tocco del pallino
  readonly onlineTip = signal(false);
  private tipTimer: ReturnType<typeof setTimeout> | undefined;

  // Invito ad attivare le notifiche (soft prompt): appare da loggati se non
  // iscritti e mai rifiutato. Il prompt NATIVO parte solo al tocco su "Attiva":
  // così chi negherebbe tocca la ✕ e non brucia il permesso a livello browser.
  private readonly notifPromptDismissed = signal(
    localStorage.getItem('ganaceto_notif_prompt_dismissed') === '1',
  );
  readonly showNotifPrompt = computed(
    () =>
      this.isLogged() &&
      this.push.supported &&
      this.push.known() &&
      !this.push.subscribed() &&
      !this.notifPromptDismissed() &&
      Notification.permission !== 'denied',
  );

  constructor() {
    this.auth.refreshOnline();
    this.auth.trackGuestVisitOnce();
    const presenceTimer = setInterval(() => this.auth.refreshOnline(), 30000);

    // riempimento ambientale: salto iniziale al target orario, poi oscilla
    this.ambient.set(this.hourlyTarget());
    const ambientTimer = setInterval(() => this.tickAmbient(), 16000);

    // aggiorna il contatore notifiche al login e periodicamente;
    // al login ripara anche l'iscrizione push (endpoint ruotati/spariti)
    effect(() => {
      if (this.isLogged()) {
        this.notifiche.refreshCount();
        void this.push.sync();
      } else {
        this.notifiche.reset();
      }
    });
    const notifTimer = setInterval(() => {
      if (this.isLogged()) this.notifiche.refreshCount();
    }, 30000);

    // controllo aggiornamenti PWA: quando una nuova versione è pronta, la attivo
    // subito e mostro la barra "Aggiorna"; verrà applicata al prossimo ritorno
    // in primo piano (ricarica), così non si resta bloccati su versioni vecchie.
    let pendingReload = false;
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((ev) => {
        if (ev.type === 'VERSION_READY') {
          this.updateReady.set(true);
          this.swUpdate.activateUpdate().then(() => { pendingReload = true; }).catch(() => {});
        }
      });
      this.swUpdate.checkForUpdate().catch(() => {});
    }

    // reattività: al ritorno in primo piano ricontrolla e, se c'è un aggiornamento
    // pronto, ricarica per applicarlo.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (pendingReload) {
        pendingReload = false;
        document.location.reload();
        return;
      }
      this.auth.refreshOnline();
      if (this.isLogged()) this.notifiche.refreshCount();
      if (this.swUpdate.isEnabled) this.swUpdate.checkForUpdate().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    inject(DestroyRef).onDestroy(() => {
      clearInterval(presenceTimer);
      clearInterval(ambientTimer);
      clearInterval(notifTimer);
      clearTimeout(this.tipTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    });
  }

  applyUpdate(): void {
    this.swUpdate.activateUpdate().then(() => document.location.reload());
  }

  async enableNotifiche(): Promise<void> {
    const ok = await this.push.enable();
    if (!ok) this.dismissNotifPrompt(); // permesso negato o errore: non insistere
  }

  dismissNotifPrompt(): void {
    this.notifPromptDismissed.set(true);
    localStorage.setItem('ganaceto_notif_prompt_dismissed', '1');
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

  // Pavimento "vivace" per fascia oraria: ~2 di giorno, ~3 di sera, 0 di notte
  // (ogni tanto +1 per farlo oscillare). Volutamente basso: paese piccolo, fase iniziale.
  private hourlyTarget(): number {
    const h = new Date().getHours();
    if (h < 7 || h >= 23) return 0; // notte: nessuno
    const base = h < 19 ? 2 : 3;
    return base + (Math.random() < 0.4 ? 1 : 0);
  }

  // Fa driftare il pavimento ambientale verso il target orario (di ±1 alla volta).
  private tickAmbient(): void {
    const target = this.hourlyTarget();
    const cur = this.ambient();
    this.ambient.set(cur < target ? cur + 1 : cur > target ? cur - 1 : cur);
  }
}
