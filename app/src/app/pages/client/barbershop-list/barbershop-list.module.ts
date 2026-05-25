import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BarbershopListPage } from './barbershop-list.page';

const routes: Routes = [{ path: '', component: BarbershopListPage }];

@NgModule({
  declarations: [BarbershopListPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class BarbershopListPageModule {}
