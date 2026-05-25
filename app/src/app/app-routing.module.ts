import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { GuestGuard } from './core/guards/auth.guard';
import { ManageBarbershopsPage } from './pages/admin/manage-barbershops/manage-barbershops.page';

const routes: Routes = [
  { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },

  // Auth — acceso público/invitado (compartida admin + cliente)
  {
    path: 'auth',
    children: [
      { path: 'login',            canActivate: [GuestGuard], loadChildren: () => import('./pages/auth/login/login.module').then(m => m.LoginPageModule) },
      { path: 'register',         canActivate: [GuestGuard], loadChildren: () => import('./pages/auth/register/register.module').then(m => m.RegisterPageModule) },
      { path: 'forgot-password',  loadChildren: () => import('./pages/auth/forgot-password/forgot-password.module').then(m => m.ForgotPasswordPageModule) },
      { path: 'reset-password',   loadChildren: () => import('./pages/auth/reset-password/reset-password.module').then(m => m.ResetPasswordPageModule) },
    ],
  },

  // ── RUTAS CLIENTE (root level) ─────────────────────────────
  {
    path: 'tabs',
    loadChildren: () => import('./pages/client/tabs/tabs.module').then(m => m.TabsPageModule),
  },
  {
    path: 'booking',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/client/booking/booking.module').then(m => m.BookingPageModule),
  },
  {
    path: 'barbershop/:id',
    loadChildren: () => import('./pages/barbershop-detail/barbershop-detail.module').then(m => m.BarbershopDetailPageModule),
  },
  {
    path: 'barbershop-list',
    loadChildren: () => import('./pages/client/barbershop-list/barbershop-list.module').then(m => m.BarbershopListPageModule),
  },
  {
    path: 'nearby-barbershops',
    loadChildren: () => import('./pages/client/nearby-barbershops/nearby-barbershops.module').then(m => m.NearbyBarbershopsPageModule),
  },
  {
    path: 'create-barber',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/client/create-barber/create-barber.module').then(m => m.CreateBarberPageModule),
  },
  {
    path: 'register-barbershop',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/client/register-barbershop/register-barbershop.module').then(m => m.RegisterBarbershopPageModule),
  },

  // ── RUTAS BARBERO ────────────────────────────────────────────
  {
    path: 'barber',
    children: [
      { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
      {
        path: 'tabs',
        canActivate: [AuthGuard],
        loadChildren: () => import('./pages/barber/tabs/tabs.module').then(m => m.BarberTabsPageModule),
      },
    ],
  },

  // ── RUTAS SUPER ADMIN ─────────────────────────────────────────
  {
    path: 'super_admin',
    children: [
      { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
      {
        path: 'tabs',
        canActivate: [AuthGuard],
        loadChildren: () => import('./pages/super-admin/tabs/tabs.module').then(m => m.SuperAdminTabsPageModule),
      },
    ],
  },

  // ── RUTAS ADMIN ─────────────────────────────────────────────
  // Admin — todo el contenido actual de la app
  {
    path: 'admin',
    children: [
      { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },

      // Tabs principales (requieren auth)
      {
        path: 'tabs',
        canActivate: [AuthGuard],
        loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule),
      },

      // Detalle de barbería (público)
      {
        path: 'barbershop/:id',
        loadChildren: () => import('./pages/barbershop-detail/barbershop-detail.module').then(m => m.BarbershopDetailPageModule),
      },

      // Flujo de reserva
      {
        path: 'booking-flow',
        canActivate: [AuthGuard],
        loadChildren: () => import('./pages/booking-flow/booking-flow.module').then(m => m.BookingFlowPageModule),
      },

      // Panel admin de barbería
      {
        path: 'barbershop-panel',
        canActivate: [AuthGuard],
        loadChildren: () => import('./pages/admin/barbershop-panel/barbershop-panel.module').then(m => m.BarbershopPanelPageModule),
      },

      // Panel de plataforma
      {
        path: 'platform',
        canActivate: [AuthGuard],
        loadChildren: () => import('./pages/admin/platform-panel/platform-panel.module').then(m => m.PlatformPanelPageModule),
      },

      // Gestión de barberías
      {
        path: 'manage-barbershops',
        canActivate: [AuthGuard],
        component: ManageBarbershopsPage,
      },

      // Gestión de usuarios
      {
        path: 'manage-users',
        canActivate: [AuthGuard],
        loadChildren: () => import('./pages/admin/manage-users/manage-users.module').then(m => m.ManageUsersPageModule),
      },

      // Perfil de barbero
      {
        path: 'barber-profile',
        canActivate: [AuthGuard],
        loadChildren: () => import('./pages/barber-profile/barber-profile.module').then(m => m.BarberProfilePageModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
