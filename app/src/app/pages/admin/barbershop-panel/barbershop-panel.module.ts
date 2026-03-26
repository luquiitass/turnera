import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BarbershopPanelPage } from './barbershop-panel.page';

const routes: Routes = [{ path: '', component: BarbershopPanelPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [BarbershopPanelPage],
})
export class BarbershopPanelPageModule {}
