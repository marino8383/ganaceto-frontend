import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BUILD_INFO } from '../../build-info';

@Component({
  selector: 'app-chi-siamo',
  imports: [DatePipe],
  templateUrl: './chi-siamo.html',
  styleUrl: './chi-siamo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChiSiamo {
  private readonly sanitizer = inject(DomSanitizer);
  readonly build = BUILD_INFO;

  readonly address = 'Via Ferruccio Cambi, 11 — 41123 Ganaceto (MO)';
  readonly phoneDisplay = '331 590 0462';
  readonly telHref = 'tel:+393315900462';
  readonly waHref = 'https://wa.me/393315900462';

  readonly mapsUrl =
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Via Ferruccio Cambi, 11, 41123 Ganaceto MO');

  // mini-mappa OpenStreetMap centrata su Ganaceto (locatore; il link apre l'indirizzo esatto su Maps)
  readonly mapEmbed: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    'https://www.openstreetmap.org/export/embed.html?bbox=10.8380%2C44.6934%2C10.8540%2C44.7010&layer=mapnik&marker=44.6972%2C10.8460',
  );
}
