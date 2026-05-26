import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { BarbershopDetailPage } from './barbershop-detail.page';
import { BarbershopDetailRoutingModule } from './barbershop-detail-routing.module';
import { BarbershopProfileModule } from '../../shared/barbershop-profile/barbershop-profile.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    BarbershopDetailRoutingModule,
    BarbershopProfileModule,
  ],
  declarations: [BarbershopDetailPage],
  exports: [BarbershopDetailPage],
})
export class BarbershopDetailPageModule {}
