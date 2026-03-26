import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { AuthGuard } from '../../core/auth.guard';

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
        path: 'profile',
        canActivate: [AuthGuard],
        loadChildren: () => import('./profile/profile.module').then(m => m.ProfilePageModule),
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
