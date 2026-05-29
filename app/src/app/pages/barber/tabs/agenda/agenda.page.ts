import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController, ToastController } from '@ionic/angular';
import { ApiService } from '../../../../core/client-api.service';
import { ActiveContextService } from '../../../../core/active-context.service';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-barber-agenda',
  templateUrl: './agenda.page.html',
  styleUrls: ['./agenda.page.scss'],
})
export class BarberAgendaPage implements OnInit {
  selectedDate: string = new Date().toISOString().split('T')[0];
  agenda: any = null;
  isLoading = false;
  error = false;
  showPicker = false;

  // Perfiles de barbero (una entrada por barbería)
  barberProfiles: any[] = [];
  selectedBarbershopId: string | null = null;

  constructor(
    private api: ApiService,
    private http: HttpClient,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    public activeCtx: ActiveContextService,
  ) {}

  ngOnInit(): void { this.loadProfiles(); }
  ionViewWillEnter(): void {
    if (this.selectedBarbershopId) this.load();
    else this.loadProfiles();
  }

  loadProfiles(): void {
    this.api.getMyBarberProfile().subscribe({
      next: (res: any) => {
        this.barberProfiles = (res.data ?? []).filter((p: any) => p.isActive !== false);
        if (!this.selectedBarbershopId) {
          // Usar contexto activo si está disponible, sino el primer perfil
          const ctxId = this.activeCtx.barbershopId;
          const match = ctxId ? this.barberProfiles.find((p: any) => p.barbershopId === ctxId) : null;
          this.selectedBarbershopId = match?.barbershopId ?? this.barberProfiles[0]?.barbershopId ?? null;
        }
        this.load();
      },
      error: () => { this.error = true; },
    });
  }

  onBarbershopChange(event: any): void {
    this.selectedBarbershopId = event.detail.value;
    this.load();
  }

  getBarbershopName(id: string | null): string {
    const p = this.barberProfiles.find(p => p.barbershopId === id);
    return p?.barbershop?.name ?? 'Barbería';
  }

  load(): void {
    if (!this.selectedBarbershopId) return;
    this.isLoading = true;
    this.error = false;
    this.api.getMyAgenda(this.selectedDate, this.selectedBarbershopId).subscribe({
      next: (res) => { this.agenda = res.data ?? res; this.isLoading = false; },
      error: () => { this.error = true; this.isLoading = false; },
    });
  }

  // ── Navegación de fechas ────────────────────────────────────────────────────

  prevDay(): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    this.selectedDate = d.toISOString().split('T')[0];
    this.load();
  }

  nextDay(): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    this.selectedDate = d.toISOString().split('T')[0];
    this.load();
  }

  onDatePick(event: any): void {
    const val = event.detail.value as string;
    if (val) {
      this.selectedDate = val.substring(0, 10);
      this.showPicker = false;
      this.load();
    }
  }

  formatDate(): string {
    const [y, m, d] = this.selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date().toISOString().split('T')[0];
    if (this.selectedDate === today) {
      return 'Hoy, ' + date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ── Turno rápido ───────────────────────────────────────────────────────────

  async startQuickBooking(preselectedTime?: string): Promise<void> {
    const barbershopId = this.agenda?.barbershopId;
    if (!barbershopId) { this.toast('No se pudo obtener la barbería'); return; }

    this.http.get<any>(`${environment.apiUrl}/services/barbershop/${barbershopId}`).subscribe({
      next: async (res: any) => {
        const services = res.data ?? [];
        if (!services.length) { this.toast('No hay servicios disponibles'); return; }
        await this.showServicePicker(services, preselectedTime);
      },
      error: () => this.toast('Error al cargar servicios'),
    });
  }

  private async showServicePicker(services: any[], preselectedTime?: string): Promise<void> {
    const inputs = services.map((s: any) => ({
      type: 'radio' as const,
      label: `${s.service?.name ?? s.name} — $${s.price} (${s.durationMin}min)`,
      value: JSON.stringify({ id: s.service?.id ?? s.serviceId, name: s.service?.name ?? s.name, price: s.price, durationMin: s.durationMin }),
    }));

    const alert = await this.alertCtrl.create({
      header: 'Seleccionar servicio',
      inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Siguiente',
          handler: (val: string) => {
            if (!val) { this.toast('Seleccioná un servicio'); return false; }
            this.showTimePicker(JSON.parse(val), preselectedTime);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async showTimePicker(service: any, preselectedTime?: string): Promise<void> {
    this.api.getAvailability(this.agenda.barberId, this.selectedDate, service.id).subscribe({
      next: async (res: any) => {
        const slots = (res.data ?? []).filter((s: any) => s.available && !s.isPast);
        if (!slots.length) { this.toast('Sin horarios disponibles para este día'); return; }

        const inputs = slots.map((s: any) => ({
          type: 'radio' as const,
          label: s.time,
          value: s.time,
          checked: s.time === preselectedTime,
        }));

        const alert = await this.alertCtrl.create({
          header: `Horario — ${service.name}`,
          inputs,
          buttons: [
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Siguiente',
              handler: (time: string) => {
                if (!time) { this.toast('Seleccioná un horario'); return false; }
                this.showClientInput(service, time);
                return true;
              },
            },
          ],
        });
        await alert.present();
      },
      error: () => this.toast('Error al cargar horarios'),
    });
  }

  private async showClientInput(service: any, time: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Datos del cliente',
      message: `${service.name} · ${time} · $${service.price}`,
      inputs: [
        { name: 'clientName',  type: 'text', placeholder: 'Nombre del cliente *' },
        { name: 'clientPhone', type: 'tel',  placeholder: 'Teléfono (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: (data: any) => {
            if (!data.clientName?.trim()) { this.toast('El nombre del cliente es obligatorio'); return false; }
            this.createBooking(service, time, data.clientName.trim(), data.clientPhone?.trim());
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private createBooking(service: any, time: string, clientName: string, clientPhone?: string): void {
    const notes = `Cliente: ${clientName}${clientPhone ? ' — Tel: ' + clientPhone : ''}`;
    this.api.createBooking({
      barberId:  this.agenda.barberId,
      serviceId: service.id,
      date:      this.selectedDate,
      startTime: time,
      notes,
    }).subscribe({
      next: () => { this.toast(`Turno creado para ${clientName}`, 'success'); this.load(); },
      error: (err: any) => {
        this.toast(err?.error?.error?.message ?? 'Error al crear el turno', 'danger');
      },
    });
  }

  // ── Helpers display ────────────────────────────────────────────────────────

  getStatusColor(status: string): string {
    const map: Record<string, string> = { CONFIRMADA: 'success', PENDIENTE: 'warning', CANCELADA: 'danger', COMPLETADA: 'medium' };
    return map[status] ?? 'medium';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = { CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente', CANCELADA: 'Cancelada', COMPLETADA: 'Completada' };
    return map[status] ?? status;
  }

  private async toast(message: string, color = 'warning'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
