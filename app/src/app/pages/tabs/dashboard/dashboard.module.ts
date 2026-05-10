import { NgModule } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { RouterLinkWithHref } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { DashboardPage } from './dashboard.page';

const routes: Routes = [{ path: '', component: DashboardPage }];

@NgModule({
  declarations: [DashboardPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes), RouterLinkWithHref],
  providers: [DecimalPipe],
})
export class DashboardPageModule {}
