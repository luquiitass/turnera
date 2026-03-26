import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { BookingFlowPage } from './booking-flow.page';
import { BookingFlowRoutingModule } from './booking-flow-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule,
    BookingFlowRoutingModule,
  ],
  declarations: [BookingFlowPage],
})
export class BookingFlowPageModule {}
