import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from "@ionic/angular";
import { ContextSubtitleModule } from "../../../../shared/context-subtitle/context-subtitle.module";
import { RouterModule, Routes } from '@angular/router';
import { BarberHomePage } from './home.page';

const routes: Routes = [{ path: '', component: BarberHomePage }];

@NgModule({
  imports: [CommonModule, ContextSubtitleModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [BarberHomePage],
})
export class BarberHomePageModule {}
