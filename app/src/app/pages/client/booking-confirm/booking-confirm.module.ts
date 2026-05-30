import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BookingConfirmPage } from './booking-confirm.page';

const routes: Routes = [{ path: '', component: BookingConfirmPage }];

@NgModule({
  declarations: [BookingConfirmPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class BookingConfirmPageModule {}
