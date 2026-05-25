import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { NotificationsPage } from './notifications.page';

const routes: Routes = [{ path: '', component: NotificationsPage }];

@NgModule({
  declarations: [NotificationsPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class NotificationsPageModule {}
