import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ActiveContextService } from '../../../core/active-context.service';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-admin-bookings',
  templateUrl: './admin-bookings.page.html',
  styleUrls: ['./admin-bookings.page.scss'],
})
export class AdminBookingsPage implements OnInit, OnDestroy {
  // ── Lista de turnos ────────────────────────────────────────────────────────
  todayBookings: any[] = [];
  isLoading = false;
  error = false;

  selectedDate: string = new Date().toISOString().split('T')[0];
  selectedStatus: string = '';

  readonly statuses = [
    { value: '', label: 'Todos' },
    { value: 'PENDIENTE', label: 'Pendiente' },
    { value: 'CONFIRMADA', label: 'Confirmada' },
    { value: 'CANCELADA', label: 'Cancelada' },
    { value: 'COMPLETADA', label: 'Completada' },
  ];

  // ── Formulario nuevo turno ─────────────────────────────────────────────────
  showNewBooking = false;
  barbers: any[] = [];
  services: any[] = [];
  availableSlots: string[] = [];

  form = {
    barberId: '',
    serviceId: '',
    startTime: '',
    clientName: '',
    clientPhone: '',
    notes: '',
  };

  loadingBarbers = false;
  loadingServices = false;
  loadingSlots = false;
  saving = false;

  private bsSub!: Subscription;

  constructor(
    private http: HttpClient,
    public activeCtx: ActiveContextService,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.bsSub = this.activeCtx.context$.subscribe(ctx => {
      if (ctx?.barbershopId) {
        this.loadBookings();
        if (this.showNewBooking) this.loadFormData();
      }
    });
  }

  ngOnDestroy(): void {
    this.bsSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.loadBookings();
  }

  // ── Carga de turnos ────────────────────────────────────────────────────────

  loadBookings(): void {
    const barbershopId = this.activeCtx.barbershopId;
    if (!barbershopId) return;

    this.isLoading = true;
    this.error = false;

    let params = new HttpParams()
      .set('from', this.selectedDate)
      .set('to', this.selectedDate)
      .set('limit', '100');

    if (this.selectedStatus) params = params.set('status', this.selectedStatus);

    this.http
      .get<any>(`${environment.apiUrl}/bookings/barbershop/${barbershopId}`, { params })
      .subscribe({
        next: (res) => {
          const bookings = res?.data?.data ?? res?.data ?? [];
          this.todayBookings = bookings.sort((a: any, b: any) =>
            (a.startTime ?? '').localeCompare(b.startTime ?? ''),
          );
          this.isLoading = false;
        },
        error: () => { this.error = true; this.isLoading = false; },
      });
  }

  onDateChange(event: any): void {
    this.selectedDate = event.detail.value?.split('T')[0] ?? this.selectedDate;
    this.loadBookings();
    if (this.form.barberId && this.form.serviceId) this.loadSlots();
  }

  onStatusChange(event: any): void {
    this.selectedStatus = event.detail.value;
    this.loadBookings();
  }

  // ── Formulario nuevo turno ─────────────────────────────────────────────────

  openNewBooking(): void {
    this.resetForm();
    this.showNewBooking = true;
    this.loadFormData();
  }

  closeNewBooking(): void {
    this.showNewBooking = false;
    this.resetForm();
  }

  private resetForm(): void {
    this.form = { barberId: '', serviceId: '', startTime: '', clientName: '', clientPhone: '', notes: '' };
    this.availableSlots = [];
  }

  private loadFormData(): void {
    this.loadBarbers();
    this.loadServices();
  }

  loadBarbers(): void {
    const id = this.activeCtx.barbershopId;
    if (!id) return;
    this.loadingBarbers = true;
    this.http.get<any>(`${environment.apiUrl}/barbers/barbershop/${id}`).subscribe({
      next: (res) => { this.barbers = res?.data ?? []; this.loadingBarbers = false; },
      error: () => { this.loadingBarbers = false; },
    });
  }

  loadServices(): void {
    const id = this.activeCtx.barbershopId;
    if (!id) return;
    this.loadingServices = true;
    this.http.get<any>(`${environment.apiUrl}/services/barbershop/${id}`).subscribe({
      next: (res) => { this.services = res?.data ?? []; this.loadingServices = false; },
      error: () => { this.loadingServices = false; },
    });
  }

  onBarberChange(event: any): void {
    this.form.barberId = event.detail.value;
    this.form.startTime = '';
    this.availableSlots = [];
    if (this.form.barberId) this.loadSlots();
  }

  onServiceChange(event: any): void {
    this.form.serviceId = event.detail.value;
    this.form.startTime = '';
    this.availableSlots = [];
    if (this.form.barberId) this.loadSlots();
  }

  loadSlots(): void {
    const { barberId, serviceId } = this.form;
    if (!barberId) return;

    this.loadingSlots = true;
    this.availableSlots = [];

    let url = `${environment.apiUrl}/schedules/availability/${barberId}/${this.selectedDate}`;
    if (serviceId) url += `?serviceId=${serviceId}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        const raw: any[] = Array.isArray(res?.data) ? res.data : [];
        // La API devuelve objetos { time, endTime, available, isPast }
        this.availableSlots = raw
          .filter(s => s.available && !s.isPast)
          .map(s => s.time ?? s);
        this.loadingSlots = false;
      },
      error: () => { this.loadingSlots = false; },
    });
  }

  async saveBooking(): Promise<void> {
    const { barberId, serviceId, startTime, clientName, notes } = this.form;
    if (!barberId || !serviceId || !startTime) {
      const t = await this.toastCtrl.create({ message: 'Completá barbero, servicio y horario.', duration: 2500, color: 'warning', position: 'top' });
      await t.present();
      return;
    }

    this.saving = true;
    const { clientPhone } = this.form;
    const clientInfo = [
      clientName ? `Cliente: ${clientName}` : '',
      clientPhone ? `Tel: ${clientPhone}` : '',
      notes || '',
    ].filter(Boolean).join(' — ');

    const body: any = {
      barberId,
      serviceId,
      date: this.selectedDate,
      startTime,
      notes: clientInfo || undefined,
    };

    this.http.post<any>(`${environment.apiUrl}/bookings`, body).subscribe({
      next: async () => {
        this.saving = false;
        this.closeNewBooking();
        this.loadBookings();
        const t = await this.toastCtrl.create({ message: 'Turno agendado correctamente.', duration: 2500, color: 'success', position: 'top' });
        await t.present();
      },
      error: async (err) => {
        this.saving = false;
        const msg = err?.error?.error?.message ?? 'No se pudo agendar el turno.';
        const t = await this.toastCtrl.create({ message: msg, duration: 3000, color: 'danger', position: 'top' });
        await t.present();
      },
    });
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  formatDate(): string {
    const d = new Date(this.selectedDate + 'T00:00:00');
    const isToday = this.selectedDate === new Date().toISOString().split('T')[0];
    if (isToday) return 'Hoy — ' + d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  getClientName(booking: any): string {
    return `${booking.user?.firstName ?? ''} ${booking.user?.lastName ?? ''}`.trim() || 'Cliente';
  }

  getBarberName(booking: any): string {
    return `${booking.barber?.firstName ?? ''} ${booking.barber?.lastName ?? ''}`.trim() || 'Barbero';
  }

  getServiceName(booking: any): string {
    return booking.service?.name ?? 'Servicio';
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = { CONFIRMADA: 'success', PENDIENTE: 'warning', CANCELADA: 'danger', COMPLETADA: 'medium', NO_SHOW: 'dark' };
    return map[status] ?? 'medium';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = { CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente', CANCELADA: 'Cancelada', COMPLETADA: 'Completada', NO_SHOW: 'No asistió' };
    return map[status] ?? status;
  }

  getBarberLabel(barber: any): string {
    return `${barber.firstName ?? ''} ${barber.lastName ?? ''}`.trim();
  }

  getServiceLabel(svc: any): string {
    const price = svc.price ? ` — $${svc.price}` : '';
    const dur   = svc.durationMin ? ` (${svc.durationMin} min)` : '';
    return `${svc.service?.name ?? svc.name}${price}${dur}`;
  }

  get confirmedCount(): number { return this.todayBookings.filter(b => b.status === 'CONFIRMADA').length; }
  get pendingCount():   number { return this.todayBookings.filter(b => b.status === 'PENDIENTE').length; }
  get canSave():        boolean { return !!(this.form.barberId && this.form.serviceId && this.form.startTime); }
}
