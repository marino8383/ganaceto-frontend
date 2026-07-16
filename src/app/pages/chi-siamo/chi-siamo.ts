import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { API_BASE_URL } from '../../app.config';
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

  // versione del backend in esecuzione (commit e data del deploy su Render)
  readonly apiVersion = signal<{ commit: string; builtAt: string } | null>(null);

  constructor() {
    inject(HttpClient)
      .get<{ commit: string; builtAt: string }>(`${inject(API_BASE_URL)}/api/version`)
      .subscribe({ next: (v) => this.apiVersion.set(v) }); // se fallisce resta nascosta
  }

  readonly address = 'Via Ferruccio Cambi, 11 — 41123 Ganaceto (MO)';
  readonly phoneDisplay = '331 590 0462';
  readonly telHref = 'tel:+393315900462';
  readonly waHref = 'https://wa.me/393315900462';

  readonly mapsUrl =
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Via Ferruccio Cambi, 11, 41123 Ganaceto MO');

  // mini-mappa OpenStreetMap sul civico (coordinate reali via geocoding Nominatim)
  readonly mapEmbed: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    'https://www.openstreetmap.org/export/embed.html?bbox=10.8955%2C44.7042%2C10.9075%2C44.7122&layer=mapnik&marker=44.7081668%2C10.9015192',
  );
}
