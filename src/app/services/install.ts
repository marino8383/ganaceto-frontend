import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Gestisce l'installazione della PWA: cattura il prompt di Android/Chrome,
// riconosce iOS (che richiede "Aggiungi a Home" manuale) e se è già installata.
@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferred: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal(false); // Android/Chrome: prompt disponibile
  readonly isIos = signal(false); // iPhone/iPad su Safari, non ancora installata
  readonly installed = signal(false);
  readonly dismissed = signal(localStorage.getItem('ganaceto_install_dismissed') === '1');

  constructor() {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    this.installed.set(standalone);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.installed.set(true);
      this.canInstall.set(false);
      this.deferred = null;
    });

    const ua = navigator.userAgent || '';
    const iOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
    this.isIos.set(iOS && !standalone);
  }

  /** true se c'è qualcosa da proporre (Android installabile o iOS con istruzioni). */
  get show(): boolean {
    return !this.installed() && !this.dismissed() && (this.canInstall() || this.isIos());
  }

  async promptInstall(): Promise<void> {
    if (!this.deferred) return;
    await this.deferred.prompt();
    await this.deferred.userChoice;
    this.deferred = null;
    this.canInstall.set(false);
  }

  dismiss(): void {
    this.dismissed.set(true);
    localStorage.setItem('ganaceto_install_dismissed', '1');
  }
}
