import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { GuestGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
  {
    path: 'auth',
    canActivate: [GuestGuard],
    children: [
      { path: 'login', loadChildren: () => import('./pages/auth/login/login.module').then(m => m.LoginPageModule) },
      { path: 'register', loadChildren: () => import('./pages/auth/register/register.module').then(m => m.RegisterPageModule) },
    ],
  },
  {
    path: 'tabs',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule),
  },
  {
    path: 'barbershop/:id',
    loadChildren: () => import('./pages/barbershop-detail/barbershop-detail.module').then(m => m.BarbershopDetailPageModule),
  },
  {
    path: 'booking-flow',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/booking-flow/booking-flow.module').then(m => m.BookingFlowPageModule),
  },
  {
    path: 'admin/barbershop',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/admin/barbershop-panel/barbershop-panel.module').then(m => m.BarbershopPanelPageModule),
  },
  {
    path: 'admin/platform',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/admin/platform-panel/platform-panel.module').then(m => m.PlatformPanelPageModule),
  },
  {
    path: 'admin/manage-barbershops',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/admin/manage-barbershops/manage-barbershops.module').then(m => m.ManageBarbershopsPageModule),
  },
  {
    path: 'admin/manage-users',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/admin/manage-users/manage-users.module').then(m => m.ManageUsersPageModule),
  },
  {
    path: 'barber-profile',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/barber-profile/barber-profile.module').then(m => m.BarberProfilePageModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
