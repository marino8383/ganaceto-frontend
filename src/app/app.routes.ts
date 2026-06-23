import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'notizie', pathMatch: 'full' },
  {
    path: 'notizie',
    loadComponent: () => import('./pages/notizie/notizie').then((m) => m.Notizie),
  },
  {
    path: 'notizie/:id',
    loadComponent: () => import('./pages/notizie/dettaglio/dettaglio').then((m) => m.NotiziaDettaglio),
  },
  {
    path: 'casina',
    loadComponent: () => import('./pages/casina/casina').then((m) => m.Casina),
  },
  {
    path: 'adesioni',
    loadComponent: () => import('./pages/adesioni/adesioni').then((m) => m.Adesioni),
  },
  {
    path: 'bacheca',
    loadComponent: () => import('./pages/bacheca/bacheca').then((m) => m.Bacheca),
  },
  {
    path: 'chi-siamo',
    loadComponent: () => import('./pages/chi-siamo/chi-siamo').then((m) => m.ChiSiamo),
  },
  {
    path: 'admin/notizie',
    loadComponent: () => import('./pages/admin/notizie/admin-notizie').then((m) => m.AdminNotizie),
    canActivate: [adminGuard],
  },
];
