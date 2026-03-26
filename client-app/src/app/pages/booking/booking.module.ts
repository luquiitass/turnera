import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { BookingRoutingModule } from './booking-routing.module';
import { BookingPage } from './booking.page';

@NgModule({
  declarations: [BookingPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule,
    BookingRoutingModule,
  ],
})
export class BookingPageModule {}
