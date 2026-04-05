import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ManageBarbershopsPage } from './manage-barbershops.page';
import { CreateBarbershopModalComponent } from '../create-barbershop-modal/create-barbershop-modal.component';

const routes: Routes = [{ path: '', component: ManageBarbershopsPage }];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
    CreateBarbershopModalComponent,
  ],
  declarations: [ManageBarbershopsPage],
})
export class ManageBarbershopsPageModule {}
