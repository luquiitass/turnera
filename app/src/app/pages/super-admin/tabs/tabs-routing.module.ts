import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SuperAdminTabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: SuperAdminTabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('./home/home.module').then(m => m.SuperAdminHomePageModule),
      },
      {
        path: 'barbershops',
        loadChildren: () => import('../../admin/manage-barbershops/manage-barbershops.module').then(m => m.ManageBarbershopsPageModule),
      },
      {
        path: 'users',
        loadChildren: () => import('../../admin/manage-users/manage-users.module').then(m => m.ManageUsersPageModule),
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
export class SuperAdminTabsRoutingModule {}
