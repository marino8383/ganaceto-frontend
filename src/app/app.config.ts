import { ApplicationConfig, InjectionToken, isDevMode, LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: API_BASE_URL, useValue: '' },
    { provide: LOCALE_ID, useValue: 'it-IT' },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
