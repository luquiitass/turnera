import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-alerts-admin-barber',
  templateUrl: './alerts-admin-barber.component.html',
  styleUrls: ['./alerts-admin-barber.component.scss'],
  standalone: false,
})
export class AlertsAdminBarberComponent {
  @Input() barbershop: any = null;
  @Input() hasSchedules = true;

  // Emite: 'add-service' | 'add-barber' | 'manage-schedules'
  @Output() actionClicked = new EventEmitter<string>();

  get missingServices(): boolean {
    return !(this.barbershop?.services?.length > 0);
  }

  get missingBarbers(): boolean {
    return !(this.barbershop?.barbers?.length > 0);
  }

  get missingSchedules(): boolean {
    return !!(this.barbershop?.barbers?.length > 0) && !this.hasSchedules;
  }

  get hasAnyAlert(): boolean {
    return this.missingServices || this.missingBarbers || this.missingSchedules;
  }

  emit(action: string): void {
    this.actionClicked.emit(action);
  }
}
