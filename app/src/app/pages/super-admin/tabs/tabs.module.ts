import { NgModule } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SuperAdminTabsRoutingModule } from './tabs-routing.module';
import { SuperAdminTabsPage } from './tabs.page';

@NgModule({
  declarations: [SuperAdminTabsPage],
  imports: [CommonModule, AsyncPipe, IonicModule, SuperAdminTabsRoutingModule],
})
export class SuperAdminTabsPageModule {}
