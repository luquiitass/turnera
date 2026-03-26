import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { PlatformPanelPage } from './platform-panel.page';

const routes: Routes = [{ path: '', component: PlatformPanelPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [PlatformPanelPage],
})
export class PlatformPanelPageModule {}
