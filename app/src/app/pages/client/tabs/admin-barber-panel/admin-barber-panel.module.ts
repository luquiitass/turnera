import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { AdminBarberPanelPage } from './admin-barber-panel.page';
import { SharedComponentsModule } from '../../../../shared/shared-components.module';

const routes: Routes = [{ path: '', component: AdminBarberPanelPage }];

@NgModule({
  declarations: [AdminBarberPanelPage],
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes), SharedComponentsModule],
})
export class AdminBarberPanelPageModule {}
