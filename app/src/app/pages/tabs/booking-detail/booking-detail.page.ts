import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BookingsService } from '../../../services/bookings.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE:  'Pendiente',
  CONFIRMADA: 'Confirmada',
  CANCELADA:  'Cancelada',
  COMPLETADA: 'Completada',
  NO_SHOW:    'No se presentó',
};
const STATUS_COLOR: Record<string, string> = {
  PENDIENTE:  'warning',
  CONFIRMADA: 'success',
  CANCELADA:  'medium',
  COMPLETADA: 'primary',
  NO_SHOW:    'danger',
};

@Component({
  selector: 'app-booking-detail',
  templateUrl: './booking-detail.page.html',
  styleUrls: ['./booking-detail.page.scss'],
  standalone: false,
})
export class BookingDetailPage implements OnInit {
  booking: any = null;
  loading = true;
  saving = false;
  backHref = '/tabs/bookings';
  payments: any[] = [];
  mpLink: string | null = null;
  generatingLink = false;
  private readonly api = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private bookingsService: BookingsService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private auth: AuthService,
    private http: HttpClient,
  ) {}

  // Admin / barbero del turno → pueden completar, no show y cancelar
  // Cliente                  → solo puede cancelar
  get isStaff(): boolean {
    const roles: string[] = this.auth.currentUser?.roles ?? [];
    if (roles.some(r => ['ADMIN_GENERAL', 'ADMIN_BARBERSHOP', 'SUB_ADMIN'].includes(r))) return true;
    // Barbero: el usuario tiene perfil de barbero vinculado a esta reserva
    const currentId = this.auth.currentUser?.id;
    return !!(currentId && this.booking?.barber?.userId === currentId);
  }

  get canMarkFinal(): boolean {
    return this.isStaff && this.isEditable;
  }

  get canCancelOnly(): boolean {
    return !this.isStaff && this.isEditable;
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  load(id: string): void {
    this.loading = true;
    this.bookingsService.getOne(id).subscribe({
      next: res => {
        this.booking = res.data;
        this.loading = false;
        this.loadPayments(id);
      },
      error: () => { this.loading = false; this.toast('No se pudo cargar la reserva', 'danger'); },
    });
  }

  loadPayments(bookingId: string): void {
    this.http.get<any>(`${this.api}/payments/booking/${bookingId}`).subscribe({
      next: res => { this.payments = res.data ?? res ?? []; },
      error: () => { this.payments = []; },
    });
  }

  refresh(event: any): void {
    this.bookingsService.getOne(this.booking.id).subscribe({
      next: res => {
        this.booking = res.data;
        this.loadPayments(this.booking.id);
        event.target.complete();
      },
      error: () => event.target.complete(),
    });
  }

  get depositPaid(): boolean { return this.booking?.depositPaid || this.payments.some(p => p.type === 'SENA' && p.status === 'APROBADO'); }
  get senaPago(): any | null { return this.payments.find(p => p.type === 'SENA' && p.status === 'APROBADO') ?? null; }
  get depositAmount(): number {
    if (this.booking?.depositPrice > 0) return this.booking.depositPrice;
    const total = this.booking?.totalPrice ?? 0;
    const rate = this.booking?.barber?.barbershop?.subscription?.minDepositRate ?? 0.3;
    return Math.ceil(total * rate);
  }
  get canManagePayments(): boolean { return this.isStaff && this.booking?.status === 'CONFIRMADA'; }
  get showPaymentsSection(): boolean { return this.booking?.status === 'CONFIRMADA' || this.payments.length > 0; }

  generateMpLink(): void {
    this.generatingLink = true;
    this.mpLink = null;
    this.http.post<any>(`${this.api}/mp/bookings/${this.booking.id}/preference`, {}).subscribe({
      next: res => {
        const data = res.data ?? res;
        this.mpLink = data.initPoint;
        this.generatingLink = false;
        this.toast('Link generado. Copialo y enviáselo al cliente.', 'success');
      },
      error: (err: any) => {
        this.generatingLink = false;
        const msg = err?.error?.error?.message ?? 'Error al generar link de pago';
        this.toast(msg, 'danger');
      },
    });
  }

  copyMpLink(): void {
    if (!this.mpLink) return;
    navigator.clipboard.writeText(this.mpLink).then(() => this.toast('Link copiado', 'success'));
  }

  async registerManualPayment(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Registrar seña manual',
      inputs: [
        { name: 'amount', type: 'number', placeholder: `Monto (sugerido: $${this.depositAmount})`, value: this.depositAmount },
        { name: 'method', type: 'text', placeholder: 'Medio: EFECTIVO / TRANSFERENCIA', value: 'EFECTIVO' },
        { name: 'notes', type: 'text', placeholder: 'Notas (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Registrar',
          handler: (data) => {
            this.http.post<any>(`${this.api}/payments/register`, {
              bookingId: this.booking.id,
              amount: parseFloat(data.amount),
              method: data.method?.trim().toUpperCase() || 'EFECTIVO',
              type: 'SENA',
              notes: data.notes || undefined,
            }).subscribe({
              next: () => {
                this.toast('Seña registrada', 'success');
                this.loadPayments(this.booking.id);
                this.booking = { ...this.booking, depositPaid: true };
              },
              error: (err: any) => this.toast(err?.error?.error?.message ?? 'Error al registrar', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  verifyingPayment = false;

  verifyPayment(): void {
    this.verifyingPayment = true;
    this.http.post<any>(`${this.api}/mp/bookings/${this.booking.id}/verify`, {}).subscribe({
      next: (res) => {
        const data = res.data ?? res;
        this.verifyingPayment = false;
        if (data.status === 'payment_processed' || data.status === 'already_paid') {
          this.toast('¡Pago confirmado! Seña registrada correctamente.', 'success');
          this.booking = { ...this.booking, depositPaid: true };
          this.loadPayments(this.booking.id);
        } else {
          this.toast('El pago aún no fue acreditado en MercadoPago.', 'warning');
        }
      },
      error: () => { this.verifyingPayment = false; this.toast('Error al verificar el pago', 'danger'); },
    });
  }

  payDeposit(): void {
    // Si ya hay un link generado, usarlo; si no, generar uno nuevo
    if (this.mpLink) { window.open(this.mpLink, '_blank'); return; }
    if (this.booking?.mpPreferenceId) {
      window.open(`https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${this.booking.mpPreferenceId}`, '_blank');
      return;
    }
    this.generatingLink = true;
    this.http.post<any>(`${this.api}/mp/bookings/${this.booking.id}/preference`, {}).subscribe({
      next: res => {
        const data = res.data ?? res;
        this.mpLink = data.initPoint;
        this.generatingLink = false;
        window.open(this.mpLink!, '_blank');
      },
      error: (err: any) => {
        this.generatingLink = false;
        this.toast(err?.error?.error?.message ?? 'Error al generar el link de pago', 'danger');
      },
    });
  }

  getPaymentStatusLabel(s: string): string {
    return { APROBADO: 'Pagado', PENDIENTE: 'Pendiente', DEUDA: 'Deuda', RECHAZADO: 'Rechazado', REEMBOLSADO: 'Reembolsado' }[s] ?? s;
  }
  getPaymentStatusColor(s: string): string {
    return { APROBADO: 'success', PENDIENTE: 'warning', DEUDA: 'danger' }[s] ?? 'medium';
  }
  getMethodLabel(m: string): string {
    return { MERCADOPAGO: 'MercadoPago', EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA_LOCAL: 'Tarjeta' }[m] ?? m;
  }

  getStatusLabel(s: string): string { return STATUS_LABEL[s] ?? s; }
  getStatusColor(s: string): string { return STATUS_COLOR[s] ?? 'medium'; }

  get isEditable(): boolean {
    return ['PENDIENTE', 'CONFIRMADA'].includes(this.booking?.status);
  }

  /** True si la hora de fin de la reserva ya pasó */
  get isBookingPast(): boolean {
    if (!this.booking?.date || !this.booking?.endTime) return false;
    const dateStr = (this.booking.date as string).split('T')[0];
    const [h, m] = this.booking.endTime.split(':').map(Number);
    const endDt = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
    return new Date() > endDt;
  }

  /** Puede marcar no-show: es staff, CONFIRMADA y la hora ya pasó */
  get canMarkNoShow(): boolean {
    return this.isStaff && this.booking?.status === 'CONFIRMADA' && this.isBookingPast;
  }

  formatDate(d: string): string {
    if (!d) return '';
    const date = new Date(d.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  async changeStatus(status: string): Promise<void> {
    const labels: Record<string, string> = {
      CONFIRMADA: 'Confirmar reserva',
      COMPLETADA: 'Marcar como completada',
      NO_SHOW:    'Marcar como no se presentó',
      CANCELADA:  'Cancelar reserva',
    };
    const alert = await this.alertCtrl.create({
      header: labels[status],
      message: `¿Confirmás el cambio de estado a <strong>${this.getStatusLabel(status)}</strong>?`,
      buttons: [
        { text: 'No', role: 'cancel' },
        { text: 'Sí', handler: () => this.doChangeStatus(status) },
      ],
    });
    await alert.present();
  }

  private doChangeStatus(status: string): void {
    this.saving = true;
    const req = status === 'CANCELADA'
      ? this.bookingsService.cancel(this.booking.id)
      : this.bookingsService.updateStatus(this.booking.id, status);

    req.subscribe({
      next: res => {
        this.booking = { ...this.booking, status: (res.data as any).status };
        this.saving = false;
        this.toast(`Estado actualizado: ${this.getStatusLabel(status)}`, 'success');
      },
      error: async (err) => {
        this.saving = false;
        const msg = err?.error?.error?.message ?? 'Error al actualizar';
        this.toast(msg, 'danger');
      },
    });
  }

  async editNotes(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Editar notas',
      inputs: [{ name: 'notes', type: 'textarea', value: this.booking.notes ?? '', placeholder: 'Notas del turno...' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            this.bookingsService.updateStatus(this.booking.id, this.booking.status).subscribe();
            this.booking = { ...this.booking, notes: data.notes };
            this.toast('Notas guardadas', 'success');
          },
        },
      ],
    });
    await alert.present();
  }

  openDirections(barbershop: any): void {
    const dest = barbershop.latitude && barbershop.longitude
      ? `${barbershop.latitude},${barbershop.longitude}`
      : encodeURIComponent(barbershop.address ?? '');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  }

  private async toast(msg: string, color = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color, position: 'bottom' });
    await t.present();
  }
}
