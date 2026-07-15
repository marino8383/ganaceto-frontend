import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BUILD_INFO } from '../../build-info';

@Component({
  selector: 'app-chi-siamo',
  imports: [DatePipe],
  templateUrl: './chi-siamo.html',
  styleUrl: './chi-siamo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChiSiamo {
  readonly build = BUILD_INFO;
}
