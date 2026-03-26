import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BarberProfilePage } from './barber-profile.page';

const routes: Routes = [{ path: '', component: BarberProfilePage }];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [BarberProfilePage],
})
export class BarberProfilePageModule {}
