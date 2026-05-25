import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { BarbershopProfilePageRoutingModule } from './barbershop-profile-routing.module';
import { BarbershopProfilePage } from './barbershop-profile.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BarbershopProfilePageRoutingModule,
  ],
  declarations: [BarbershopProfilePage],
})
export class BarbershopProfilePageModule {}
