import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BarberTabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: BarberTabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('./home/home.module').then(m => m.BarberHomePageModule),
      },
      {
        path: 'bookings',
        loadChildren: () => import('./agenda/agenda.module').then(m => m.BarberAgendaPageModule),
      },
      {
        path: 'booking/:id',
        loadChildren: () => import('../../tabs/booking-detail/booking-detail.module').then(m => m.BookingDetailPageModule),
      },
      {
        path: 'notifications',
        loadChildren: () => import('../../client/tabs/notifications/notifications.module').then(m => m.NotificationsPageModule),
      },
      {
        path: 'profile',
        loadChildren: () => import('../../client/tabs/profile/profile.module').then(m => m.ProfilePageModule),
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class BarberTabsRoutingModule {}
