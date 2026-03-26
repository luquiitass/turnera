import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { CreateBarberPage } from './create-barber.page';

const routes: Routes = [{ path: '', component: CreateBarberPage }];

@NgModule({
  declarations: [CreateBarberPage],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, RouterModule.forChild(routes)],
})
export class CreateBarberPageModule {}
