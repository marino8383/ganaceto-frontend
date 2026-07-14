import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { Push } from '../../services/push';

declare const google: {
  accounts: {
    id: {
      initialize: (config: object) => void;
      renderButton: (element: HTMLElement, config: object) => void;
    };
  };
};

const GOOGLE_CLIENT_ID =
  '297344978019-u5112np58mb761jq7mhpt62csecpc3vl.apps.googleusercontent.com';

@Component({
  selector: 'app-profilo-sheet',
  imports: [RouterLink],
  templateUrl: './profilo-sheet.html',
  styleUrl: './profilo-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfiloSheet {
  private readonly sheetRef = inject(MatBottomSheetRef<ProfiloSheet>);
  readonly auth = inject(Auth);
  readonly push = inject(Push);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async togglePush(): Promise<void> {
    if (this.push.subscribed()) {
      await this.push.disable();
    } else {
      await this.push.enable();
    }
  }

  private readonly googleBtnEl = viewChild<ElementRef<HTMLDivElement>>('googleBtn');

  constructor() {
    afterNextRender(() => {
      if (!this.auth.isLoggedIn) {
        this.initGoogle();
      }
    });
  }

  private initGoogle() {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) =>
        this.onGoogleToken(response.credential),
    });

    const el = this.googleBtnEl()?.nativeElement;
    if (el) {
      google.accounts.id.renderButton(el, {
        type: 'standard',
        shape: 'pill',
        theme: 'outline',
        text: 'signin_with',
        locale: 'it',
        size: 'large',
      });
    }
  }

  private onGoogleToken(idToken: string) {
    this.loading.set(true);
    this.error.set(null);
    this.auth.googleLogin(idToken).subscribe({
      next: (result) => {
        this.auth.setUser(result);
        this.loading.set(false);
        this.sheetRef.dismiss();
      },
      error: () => {
        this.error.set('Accesso non riuscito. Riprova.');
        this.loading.set(false);
      },
    });
  }

  logout() {
    this.auth.logout();
    this.sheetRef.dismiss();
  }

  close() {
    this.sheetRef.dismiss();
  }
}
