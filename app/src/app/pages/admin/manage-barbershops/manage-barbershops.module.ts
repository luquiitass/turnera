import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ManageBarbershopsPage } from './manage-barbershops.page';

const routes: Routes = [{ path: '', component: ManageBarbershopsPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [ManageBarbershopsPage],
})
export class ManageBarbershopsPageModule {}
