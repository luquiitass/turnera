import { NgModule } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TabsRoutingModule } from './tabs-routing.module';
import { TabsPage } from './tabs.page';

@NgModule({
  declarations: [TabsPage],
  imports: [
    CommonModule,
    AsyncPipe,
    IonicModule,
    TabsRoutingModule,
  ],
})
export class TabsPageModule {}
