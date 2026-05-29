import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { AdminBookingsPage } from './admin-bookings.page';
import { ContextSubtitleModule } from '../../../shared/context-subtitle/context-subtitle.module';

const routes: Routes = [{ path: '', component: AdminBookingsPage }];

@NgModule({
  imports: [CommonModule, FormsModule, ContextSubtitleModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [AdminBookingsPage],
})
export class AdminBookingsPageModule {}
