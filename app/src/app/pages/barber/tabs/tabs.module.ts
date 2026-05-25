import { NgModule } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { BarberTabsRoutingModule } from './tabs-routing.module';
import { BarberTabsPage } from './tabs.page';

@NgModule({
  declarations: [BarberTabsPage],
  imports: [CommonModule, AsyncPipe, IonicModule, BarberTabsRoutingModule],
})
export class BarberTabsPageModule {}
