import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ManageUsersPage } from './manage-users.page';

const routes: Routes = [{ path: '', component: ManageUsersPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [ManageUsersPage],
})
export class ManageUsersPageModule {}
