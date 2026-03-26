import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { environment } from '../../../../environments/environment';

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
  COMPLETADA: 'Completada',
  NO_SHOW: 'No asistio',
};

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'warning',
  CONFIRMADA: 'success',
  CANCELADA: 'medium',
  COMPLETADA: 'primary',
  NO_SHOW: 'danger',
};

@Component({
  selector: 'app-bookings',
  templateUrl: './bookings.page.html',
  styleUrls: ['./bookings.page.scss'],
  standalone: false,
})
export class BookingsPage implements OnInit {
  // Main tab: client or barber
  mainTab: 'client' | 'barber' = 'client';
  isBarber = false;

  // Client bookings
  allBookings: any[] = [];
  filteredBookings: any[] = [];
  selectedBooking: any = null;
  segment: 'upcoming' | 'past' | 'all' = 'upcoming';
  loading = true;
  error = false;
  cancelling = false;

  // Barber agenda
  agendaDate = new Date().toISOString().split('T')[0];
  agenda: any = null;
  agendaLoading = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.checkIfBarber();
    this.loadBookings();
  }

  ionViewWillEnter(): void {
    if (this.isBarber) {
      this.loadAgenda();
    } else {
      this.loadBookings();
    }
  }

  doRefresh(event: any): void {
    if (this.isBarber) {
      this.api.getMyAgenda(this.agendaDate).subscribe({
        next: (res: any) => { this.agenda = res.data; event.target.complete(); },
        error: () => { event.target.complete(); },
      });
    } else {
      this.api.getMyBookings().subscribe({
        next: (res) => {
          const raw = res.data;
          this.allBookings = Array.isArray(raw) ? raw : (raw?.data ?? []);
          this.applyFilter();
          event.target.complete();
        },
        error: () => { event.target.complete(); },
      });
    }
  }

  checkIfBarber(): void {
    this.api.getMyBarberProfile().subscribe({
      next: (res: any) => {
        const profiles = res.data || [];
        this.isBarber = profiles.some((p: any) => p.barbershopId === environment.barbershopId);
        if (this.isBarber) this.loadAgenda();
      },
      error: () => { this.isBarber = false; },
    });
  }

  onMainTabChange(tab: 'client' | 'barber'): void {
    this.mainTab = tab;
    if (tab === 'barber') this.loadAgenda();
  }

  // ==================== CLIENT BOOKINGS ====================

  loadBookings(): void {
    this.loading = true;
    this.error = false;
    this.selectedBooking = null;

    this.api.getMyBookings().subscribe({
      next: (res) => {
        const raw = res.data;
        this.allBookings = Array.isArray(raw) ? raw : (raw?.data ?? []);
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.error = true; this.loading = false; },
    });
  }

  onSegmentChange(event: any): void {
    this.segment = event.detail.value;
    this.applyFilter();
  }

  applyFilter(): void {
    const now = new Date();
    if (this.segment === 'upcoming') {
      this.filteredBookings = this.allBookings.filter(b => {
        const date = new Date(b.date);
        return date >= now && b.status !== 'CANCELADA' && b.status !== 'COMPLETADA' && b.status !== 'NO_SHOW';
      });
    } else if (this.segment === 'past') {
      this.filteredBookings = this.allBookings.filter(b => {
        const date = new Date(b.date);
        return date < now || b.status === 'COMPLETADA' || b.status === 'CANCELADA' || b.status === 'NO_SHOW';
      });
    } else {
      this.filteredBookings = [...this.allBookings];
    }
  }

  selectBooking(booking: any): void {
    this.selectedBooking = this.selectedBooking?.id === booking.id ? null : booking;
  }

  canCancel(booking: any): boolean {
    return booking?.status === 'PENDIENTE' || booking?.status === 'CONFIRMADA';
  }

  async confirmCancel(booking: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cancelar turno',
      message: 'Confirmas que deseas cancelar este turno?',
      buttons: [
        { text: 'No', role: 'cancel' },
        { text: 'Si, cancelar', role: 'destructive', handler: () => this.doCancel(booking) },
      ],
    });
    await alert.present();
  }

  private doCancel(booking: any): void {
    this.cancelling = true;
    this.api.cancelBooking(booking.id).subscribe({
      next: async () => {
        this.cancelling = false;
        this.selectedBooking = null;
        this.loadBookings();
        const toast = await this.toastCtrl.create({ message: 'Turno cancelado', duration: 2500, color: 'success', position: 'bottom' });
        await toast.present();
      },
      error: async (err: any) => {
        this.cancelling = false;
        const msg = err?.error?.error?.message ?? err?.error?.message ?? 'No se pudo cancelar el turno.';
        const toast = await this.toastCtrl.create({ message: msg, duration: 3000, color: 'danger', position: 'bottom' });
        await toast.present();
      },
    });
  }

  // ==================== BARBER BLOCK TIME ====================

  async blockTimeRange(): Promise<void> {
    if (!this.agenda?.barberId) return;

    const alert = await this.alertCtrl.create({
      header: 'Bloquear horario',
      message: `Fecha: ${this.formatAgendaDate(this.agendaDate)}`,
      inputs: [
        { name: 'startTime', type: 'time', label: 'Desde', value: '09:00' },
        { name: 'endTime', type: 'time', label: 'Hasta', value: '10:00' },
        { name: 'reason', type: 'text', placeholder: 'Motivo (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Bloquear',
          cssClass: 'alert-button-danger',
          handler: (data: any) => {
            if (!data.startTime || !data.endTime) {
              this.showToast('Completa el horario');
              return false;
            }
            if (data.startTime >= data.endTime) {
              this.showToast('La hora de fin debe ser posterior a la de inicio');
              return false;
            }
            this.api.createBlock({
              barberId: this.agenda.barberId,
              date: this.agendaDate,
              startTime: data.startTime,
              endTime: data.endTime,
              reason: data.reason?.trim() || undefined,
            }).subscribe({
              next: () => {
                this.showToast('Horario bloqueado', 'success');
                this.loadAgenda();
              },
              error: (err: any) => {
                const msg = err?.error?.error?.message ?? err?.error?.message ?? 'Error al bloquear horario';
                this.showToast(msg, 'danger');
              },
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  // ==================== BARBER AGENDA ====================

  loadAgenda(): void {
    this.agendaLoading = true;
    this.api.getMyAgenda(this.agendaDate).subscribe({
      next: (res: any) => {
        this.agenda = res.data;
        this.agendaLoading = false;
      },
      error: () => { this.agenda = null; this.agendaLoading = false; },
    });
  }

  onAgendaDateChange(event: any): void {
    const val = event.detail?.value || '';
    this.agendaDate = val.substring(0, 10);
    this.loadAgenda();
  }

  prevDay(): void {
    const d = new Date(this.agendaDate);
    d.setDate(d.getDate() - 1);
    this.agendaDate = d.toISOString().split('T')[0];
    this.loadAgenda();
  }

  nextDay(): void {
    const d = new Date(this.agendaDate);
    d.setDate(d.getDate() + 1);
    this.agendaDate = d.toISOString().split('T')[0];
    this.loadAgenda();
  }

  // ==================== BARBER QUICK BOOKING ====================

  async startQuickBooking(preselectedTime?: string): Promise<void> {
    // 1. Load services
    this.api.getServices().subscribe({
      next: (res: any) => {
        const services = res.data ?? [];
        if (!services.length) {
          this.showToast('No hay servicios disponibles');
          return;
        }
        this.showServicePicker(services, preselectedTime);
      },
      error: () => this.showToast('Error al cargar servicios'),
    });
  }

  async showServicePicker(services: any[], preselectedTime?: string): Promise<void> {
    const inputs = services.map((s: any) => ({
      type: 'radio' as const,
      label: `${s.service?.name || s.name} - $${s.price} (${s.durationMin}min)`,
      value: JSON.stringify({ id: s.service?.id || s.serviceId, name: s.service?.name || s.name, price: s.price, durationMin: s.durationMin }),
    }));

    const alert = await this.alertCtrl.create({
      header: 'Seleccionar servicio',
      inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Siguiente',
          handler: (val: string) => {
            if (!val) { this.showToast('Selecciona un servicio'); return false; }
            const service = JSON.parse(val);
            this.showTimePicker(service, preselectedTime);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async showTimePicker(service: any, preselectedTime?: string): Promise<void> {
    // Load available slots for this barber on this date
    this.api.getAvailability(this.agenda.barberId, this.agendaDate, service.id).subscribe({
      next: async (res: any) => {
        const slots = (res.data ?? []).filter((s: any) => s.available);
        if (!slots.length) {
          this.showToast('No hay horarios disponibles');
          return;
        }

        const inputs = slots.map((s: any) => ({
          type: 'radio' as const,
          label: s.time,
          value: s.time,
          checked: s.time === preselectedTime,
        }));

        const alert = await this.alertCtrl.create({
          header: `Horario - ${service.name}`,
          inputs,
          buttons: [
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Siguiente',
              handler: (time: string) => {
                if (!time) { this.showToast('Selecciona un horario'); return false; }
                this.showClientNameInput(service, time);
                return true;
              },
            },
          ],
        });
        await alert.present();
      },
      error: () => this.showToast('Error al cargar horarios'),
    });
  }

  async showClientNameInput(service: any, time: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Datos del cliente',
      message: `${service.name} - ${time} - $${service.price}`,
      inputs: [
        { name: 'clientName', type: 'text', placeholder: 'Nombre del cliente' },
        { name: 'clientPhone', type: 'tel', placeholder: 'Telefono (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar turno',
          handler: (data: any) => {
            if (!data.clientName?.trim()) {
              this.showToast('El nombre del cliente es obligatorio');
              return false;
            }
            this.createQuickBooking(service, time, data.clientName.trim(), data.clientPhone?.trim());
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  createQuickBooking(service: any, time: string, clientName: string, clientPhone?: string): void {
    const notes = `Reserva por barbero. Cliente: ${clientName}${clientPhone ? ' - Tel: ' + clientPhone : ''}`;
    this.api.createBooking({
      barberId: this.agenda.barberId,
      serviceId: service.id,
      date: this.agendaDate,
      startTime: time,
      notes,
    }).subscribe({
      next: () => {
        this.showToast('Turno creado para ' + clientName, 'success');
        this.loadAgenda();
      },
      error: (err: any) => {
        const msg = err?.error?.error?.message ?? err?.error?.message ?? 'Error al crear turno';
        this.showToast(msg, 'danger');
      },
    });
  }

  async showToast(message: string, color = 'warning'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }

  // ==================== HELPERS ====================

  getStatusLabel(status: string): string { return STATUS_LABELS[status] ?? status; }
  getStatusColor(status: string): string { return STATUS_COLORS[status] ?? 'medium'; }

  formatDate(value: string): string {
    if (!value) return '';
    const dateStr = value.split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatAgendaDate(value: string): string {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
