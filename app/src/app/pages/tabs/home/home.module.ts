import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from "@ionic/angular";
import { ContextSubtitleModule } from "../../../shared/context-subtitle/context-subtitle.module";
import { BarbershopProfileModule } from "../../../shared/barbershop-profile/barbershop-profile.module";
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './home.page';

const routes: Routes = [
  {
    path: '',
    component: HomePage,
  },
];

@NgModule({
  imports: [
    ContextSubtitleModule,
    BarbershopProfileModule,
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
  ],
  declarations: [HomePage],
})
export class HomePageModule {}
