import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastController, AlertController } from '@ionic/angular';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-booking-confirm',
  templateUrl: './booking-confirm.page.html',
  styleUrls: ['./booking-confirm.page.scss'],
  standalone: false,
})
export class BookingConfirmPage implements OnInit {
  booking: any = null;
  isLoading = true;
  error: string | null = null;

  mpInitPoint: string | null = null;
  preferenceLoading = false;
  verifying = false;
  paymentDone = false;

  private readonly api = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit(): void {
    const bookingId = this.route.snapshot.paramMap.get('id');
    const status    = this.route.snapshot.queryParamMap.get('status');
    if (!bookingId) { this.router.navigateByUrl('/tabs/bookings', { replaceUrl: true }); return; }
    this.loadBooking(bookingId, status);
  }

  private loadBooking(id: string, returnStatus: string | null): void {
    this.isLoading = true;
    this.http.get<any>(`${this.api}/bookings/${id}`).subscribe({
      next: (res) => {
        this.booking = res.data ?? res;
        this.isLoading = false;

        // Volviendo de MP con ?status=success → verificar automáticamente (antes de cualquier otra lógica)
        if (returnStatus === 'success') {
          this.verifyPayment();
          return;
        }

        // Seña paga → éxito
        if (this.booking.depositPaid) {
          this.paymentDone = true;
          return;
        }

        // Sin seña requerida y ya confirmada → éxito
        if (!this.needsDeposit && this.booking.status === 'CONFIRMADA') {
          this.paymentDone = true;
          return;
        }

        // Tiene seña pendiente (PENDIENTE o CONFIRMADA sin pago) → cargar preferencia MP
        if (this.needsDeposit && !this.booking.depositPaid) {
          this.loadPreference(id);
        }
      },
      error: () => { this.isLoading = false; this.error = 'No se pudo cargar la reserva.'; },
    });
  }

  get needsDeposit(): boolean { return (this.booking?.depositPrice ?? 0) > 0; }
  get depositAmount(): number { return this.booking?.depositPrice ?? 0; }
  get totalPrice(): number    { return this.booking?.totalPrice ?? 0; }
  get balance(): number       { return Math.max(0, this.totalPrice - this.depositAmount); }
  get isPending(): boolean    { return this.booking?.status === 'PENDIENTE'; }
  get isCancelled(): boolean  { return this.booking?.status === 'CANCELADA'; }

  loadPreference(bookingId?: string): void {
    const id = bookingId ?? this.booking?.id;
    if (!id || this.preferenceLoading || this.mpInitPoint) return;
    this.preferenceLoading = true;
    this.http.post<any>(`${this.api}/mp/bookings/${id}/preference`, {}).subscribe({
      next: (res) => {
        const data = res.data ?? res;
        this.mpInitPoint = data.initPoint ?? null;
        // Sincronizar depositPrice si la API lo actualizó (config cambió desde la creación)
        if (data.depositAmount != null) {
          this.booking = { ...this.booking, depositPrice: data.depositAmount };
        }
        this.preferenceLoading = false;
      },
      error: () => { this.preferenceLoading = false; },
    });
  }

  payWithMP(): void {
    if (this.mpInitPoint) { window.location.href = this.mpInitPoint; return; }
    const id = this.booking?.id;
    if (!id || this.preferenceLoading) return;
    this.preferenceLoading = true;
    this.http.post<any>(`${this.api}/mp/bookings/${id}/preference`, {}).subscribe({
      next: (res) => {
        this.preferenceLoading = false;
        const data = res.data ?? res;
        this.mpInitPoint = data.initPoint ?? null;
        if (data.depositAmount != null) {
          this.booking = { ...this.booking, depositPrice: data.depositAmount };
        }
        if (this.mpInitPoint) { window.location.href = this.mpInitPoint; }
        else this.toast('No se pudo generar el link de pago.', 'danger');
      },
      error: () => { this.preferenceLoading = false; this.toast('Error al generar el pago.', 'danger'); },
    });
  }

  verifyPayment(): void {
    if (this.verifying || !this.booking?.id) return;
    this.verifying = true;
    this.http.post<any>(`${this.api}/mp/bookings/${this.booking.id}/verify`, {}).subscribe({
      next: (res) => {
        this.verifying = false;
        const s = res.data?.status ?? res.status;
        if (s === 'payment_processed' || s === 'already_paid') {
          this.booking = { ...this.booking, depositPaid: true, status: 'CONFIRMADA' };
          this.paymentDone = true;
        } else {
          this.toast('El pago aún no fue acreditado. Intentá de nuevo en unos instantes.', 'warning');
        }
      },
      error: () => { this.verifying = false; this.toast('No se pudo verificar el pago.', 'danger'); },
    });
  }

  async skipPayment(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Pagar en persona',
      message: 'Tu turno quedará <strong>Pendiente</strong> hasta que abones la seña en la barbería. Si no pagás antes del turno puede ser cancelado.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Entendido', handler: () => this.router.navigateByUrl('/tabs/bookings', { replaceUrl: true }) },
      ],
    });
    await alert.present();
  }

  goToBookings(): void { this.router.navigateByUrl('/tabs/bookings', { replaceUrl: true }); }
  goToHome(): void     { this.router.navigateByUrl('/tabs/home',     { replaceUrl: true }); }

  private async toast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 3500, color, position: 'top' });
    await t.present();
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  formatPrice(n: number): string { return '$' + Math.round(n).toLocaleString('es-AR'); }
}
