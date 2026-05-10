import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { AuthGuard } from '../../../core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('./home/home.module').then(m => m.HomePageModule),
      },
      {
        path: 'bookings',
        canActivate: [AuthGuard],
        loadChildren: () => import('./bookings/bookings.module').then(m => m.BookingsPageModule),
      },
      {
        path: 'booking/:id',
        canActivate: [AuthGuard],
        loadChildren: () => import('../../tabs/booking-detail/booking-detail.module').then(m => m.BookingDetailPageModule),
      },
      {
        path: 'notifications',
        canActivate: [AuthGuard],
        loadChildren: () => import('./notifications/notifications.module').then(m => m.NotificationsPageModule),
      },
      {
        path: 'profile',
        canActivate: [AuthGuard],
        loadChildren: () => import('./profile/profile.module').then(m => m.ProfilePageModule),
      },
      {
        path: 'dashboard',
        canActivate: [AuthGuard],
        loadChildren: () => import('../../tabs/dashboard/dashboard.module').then(m => m.DashboardPageModule),
      },
      {
        path: 'admin-panel',
        canActivate: [AuthGuard],
        loadChildren: () => import('./admin-barber-panel/admin-barber-panel.module').then(m => m.AdminBarberPanelPageModule),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsRoutingModule {}
