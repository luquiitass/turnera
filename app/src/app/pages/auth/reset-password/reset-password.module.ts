import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ResetPasswordPage } from './reset-password.page';

const routes: Routes = [{ path: '', component: ResetPasswordPage }];

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [ResetPasswordPage],
})
export class ResetPasswordPageModule {}
