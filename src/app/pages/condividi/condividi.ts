import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Auth } from '../../services/auth';
import { ShareDraftService } from '../../services/share-draft';
import { ProfiloSheet } from '../../components/profilo-sheet/profilo-sheet';

@Component({
  selector: 'app-condividi',
  imports: [ReactiveFormsModule],
  templateUrl: './condividi.html',
  styleUrl: './condividi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Condividi implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly draft = inject(ShareDraftService);
  private readonly bottomSheet = inject(MatBottomSheet);
  readonly auth = inject(Auth);

  readonly error = signal<string | null>(null);

  // Precompilato dai parametri della condivisione (Web Share Target) o incollato a mano.
  readonly form = this.fb.nonNullable.group({
    title: [''],
    text: [''],
    url: [''],
  });

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.form.patchValue({
      title: q.get('title') ?? '',
      text: q.get('text') ?? '',
      // alcune app mettono il link dentro "text": se url manca, provo a estrarlo
      url: q.get('url') ?? this.extractUrl(q.get('text') ?? ''),
    });
  }

  creaNotizia(): void {
    this.go('/admin/notizie');
  }

  pubblicaBacheca(): void {
    this.go('/bacheca');
  }

  accedi(): void {
    this.bottomSheet.open(ProfiloSheet);
  }

  private go(target: string): void {
    const v = this.form.getRawValue();
    const d = { title: v.title.trim(), text: v.text.trim(), url: v.url.trim() };
    if (!d.title && !d.text && !d.url) {
      this.error.set('Incolla un link o scrivi qualcosa da condividere.');
      return;
    }
    this.draft.set(d);
    this.router.navigateByUrl(target);
  }

  private extractUrl(text: string): string {
    const m = text.match(/https?:\/\/\S+/);
    return m ? m[0] : '';
  }
}
