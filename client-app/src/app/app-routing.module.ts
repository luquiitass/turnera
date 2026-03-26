import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
  {
    path: 'auth',
    children: [
      { path: 'login', loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule) },
      { path: 'register', loadChildren: () => import('./pages/register/register.module').then(m => m.RegisterPageModule) },
    ],
  },
  {
    path: 'tabs',
    loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule),
  },
  {
    path: 'booking',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/booking/booking.module').then(m => m.BookingPageModule),
  },
  {
    path: 'barbershop-list',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/barbershop-list/barbershop-list.module').then(m => m.BarbershopListPageModule),
  },
  {
    path: 'create-barber',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/create-barber/create-barber.module').then(m => m.CreateBarberPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
