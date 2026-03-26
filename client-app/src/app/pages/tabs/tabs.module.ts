import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TabsRoutingModule } from './tabs-routing.module';
import { TabsPage } from './tabs.page';

@NgModule({
  declarations: [TabsPage],
  imports: [
    CommonModule,
    IonicModule,
    TabsRoutingModule,
  ],
})
export class TabsPageModule {}
