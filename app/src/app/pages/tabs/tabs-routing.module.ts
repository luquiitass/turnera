import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

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
        path: 'search',
        loadChildren: () => import('./search/search.module').then(m => m.SearchPageModule),
      },
      {
        path: 'bookings',
        loadChildren: () => import('./my-bookings/my-bookings.module').then(m => m.MyBookingsPageModule),
      },
      {
        path: 'booking/:id',
        loadChildren: () => import('./booking-detail/booking-detail.module').then(m => m.BookingDetailPageModule),
      },
      {
        path: 'notifications',
        loadChildren: () => import('../client/tabs/notifications/notifications.module').then(m => m.NotificationsPageModule),
      },
      {
        path: 'profile',
        loadChildren: () => import('./profile/profile.module').then(m => m.ProfilePageModule),
      },
      {
        path: 'dashboard',
        loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardPageModule),
      },
      {
        path: 'payments',
        loadChildren: () => import('../client/tabs/payments/payments.module').then(m => m.PaymentsPageModule),
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
export class TabsPageRoutingModule {}
