import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BarbershopTabPage } from './barbershop.page';
import { BarbershopProfileModule } from '../../../shared/barbershop-profile/barbershop-profile.module';
import { ContextSubtitleModule } from '../../../shared/context-subtitle/context-subtitle.module';

const routes: Routes = [
  { path: '', component: BarbershopTabPage },
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
    BarbershopProfileModule,
    ContextSubtitleModule,
  ],
  declarations: [BarbershopTabPage],
})
export class BarbershopTabPageModule {}
