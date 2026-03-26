import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { MyBookingsPage } from './my-bookings.page';

const routes: Routes = [
  {
    path: '',
    component: MyBookingsPage,
  },
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
  ],
  declarations: [MyBookingsPage],
})
export class MyBookingsPageModule {}
