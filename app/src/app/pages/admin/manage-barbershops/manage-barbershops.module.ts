import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManageBarbershopsPage } from './manage-barbershops.page';

const routes: Routes = [{ path: '', component: ManageBarbershopsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class ManageBarbershopsPageModule {}
