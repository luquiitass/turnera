import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { BookingDetailPage } from './booking-detail.page';

const routes: Routes = [{ path: '', component: BookingDetailPage }];

@NgModule({
  declarations: [BookingDetailPage],
  imports: [CommonModule, IonicModule, HttpClientModule, RouterModule.forChild(routes)],
})
export class BookingDetailPageModule {}
