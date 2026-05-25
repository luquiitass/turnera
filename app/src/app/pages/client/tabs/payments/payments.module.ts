import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { PaymentsPage } from './payments.page';

const routes: Routes = [{ path: '', component: PaymentsPage }];

@NgModule({
  declarations: [PaymentsPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class PaymentsPageModule {}
