import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { BarbershopDetailPage } from './barbershop-detail.page';
import { BarbershopDetailRoutingModule } from './barbershop-detail-routing.module';
import { SharedComponentsModule } from '../../shared/shared-components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule,
    BarbershopDetailRoutingModule,
    SharedComponentsModule,
  ],
  declarations: [BarbershopDetailPage],
})
export class BarbershopDetailPageModule {}
