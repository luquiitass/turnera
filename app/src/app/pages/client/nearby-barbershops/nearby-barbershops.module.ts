import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NearbyBarbershopsPageRoutingModule } from './nearby-barbershops-routing.module';
import { NearbyBarbershopsPage } from './nearby-barbershops.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NearbyBarbershopsPageRoutingModule,
    NearbyBarbershopsPage,
  ],
})
export class NearbyBarbershopsPageModule {}
