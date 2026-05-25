import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { RegisterBarbershopPage } from './register-barbershop.page';

const routes: Routes = [{ path: '', component: RegisterBarbershopPage }];

@NgModule({
  declarations: [RegisterBarbershopPage],
  imports: [CommonModule, ReactiveFormsModule, IonicModule, RouterModule.forChild(routes)],
})
export class RegisterBarbershopPageModule {}
