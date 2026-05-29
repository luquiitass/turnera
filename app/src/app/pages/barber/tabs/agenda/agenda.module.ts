import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BarberAgendaPage } from './agenda.page';
import { ContextSubtitleModule } from '../../../../shared/context-subtitle/context-subtitle.module';

const routes: Routes = [{ path: '', component: BarberAgendaPage }];

@NgModule({
  imports: [CommonModule, HttpClientModule, ContextSubtitleModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [BarberAgendaPage],
})
export class BarberAgendaPageModule {}
