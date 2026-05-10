import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AlertsAdminBarberComponent } from './components/alerts-admin-barber/alerts-admin-barber.component';

@NgModule({
  declarations: [AlertsAdminBarberComponent],
  imports: [CommonModule, IonicModule],
  exports: [AlertsAdminBarberComponent],
})
export class SharedComponentsModule {}
