import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NearbyBarbershopsPage } from './nearby-barbershops.page';

const routes: Routes = [
  {
    path: '',
    component: NearbyBarbershopsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NearbyBarbershopsPageRoutingModule {}
