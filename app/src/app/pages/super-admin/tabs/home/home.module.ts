import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { SuperAdminHomePage } from './home.page';

const routes: Routes = [{ path: '', component: SuperAdminHomePage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [SuperAdminHomePage],
})
export class SuperAdminHomePageModule {}
