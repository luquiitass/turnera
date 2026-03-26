import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BarbershopDetailPage } from './barbershop-detail.page';

const routes: Routes = [
  {
    path: '',
    component: BarbershopDetailPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BarbershopDetailRoutingModule {}
