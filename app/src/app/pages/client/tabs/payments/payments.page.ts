import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BarbershopResolverService } from '../../../../core/barbershop-resolver.service';
import { BarbershopsService } from '../../../../services/barbershops.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-payments',
  templateUrl: './payments.page.html',
  styleUrls: ['./payments.page.scss'],
  standalone: false,
})
export class PaymentsPage implements OnInit, AfterViewInit {
  @ViewChild('monthsScroll') monthsScrollRef!: ElementRef;

  barbershopId = '';
  barbershopName = '';
  loading = false;

  // Meses cargados (ventana deslizante: mes actual ± 6)
  months: { year: number; month: number; data: any | null; loading: boolean }[] = [];
  currentIndex = 6; // índice del mes actual en el array

  readonly MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                           'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private resolver: BarbershopResolverService,
    private barbershopsService: BarbershopsService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    // Prioridad: query param > environment > resolver
    const paramId = this.route.snapshot.queryParamMap.get('barbershopId');
    this.barbershopId = paramId || environment.barbershopId || this.resolver.barbershop?.id || '';
    this.barbershopName = this.resolver.barbershop?.name || '';

    // Si viene por query param sin nombre, cargarlo
    if (paramId && !this.barbershopName) {
      this.barbershopsService.getOne(paramId).subscribe({
        next: (res: any) => { this.barbershopName = res.data?.name ?? ''; },
      });
    }
    this.buildMonthSlots();
  }

  ngAfterViewInit(): void {
    // Scroll al mes actual sin animación
    setTimeout(() => this.scrollToIndex(this.currentIndex, false), 100);
  }

  ionViewWillEnter(): void {
    if (this.barbershopId) {
      this.loadMonth(this.currentIndex);
    }
  }

  // Construir 13 slots: 6 meses atrás + actual + 6 meses adelante
  private buildMonthSlots(): void {
    const now = new Date();
    this.months = [];
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      this.months.push({ year: d.getFullYear(), month: d.getMonth() + 1, data: null, loading: false });
    }
  }

  // Cargar un mes específico
  loadMonth(idx: number): void {
    const slot = this.months[idx];
    if (!slot || slot.data || slot.loading || !this.barbershopId) return;
    slot.loading = true;
    this.http.get<any>(`${this.apiUrl}/payments/barbershop/${this.barbershopId}/monthly?year=${slot.year}&month=${slot.month}`)
      .subscribe({
        next: (res: any) => { slot.data = res.data ?? res; slot.loading = false; },
        error: () => { slot.loading = false; },
      });
  }

  // Scroll programático al índice
  private scrollToIndex(idx: number, animated = true): void {
    const el: HTMLElement = this.monthsScrollRef?.nativeElement;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: idx * w, behavior: animated ? 'smooth' : 'auto' });
  }

  // Cuando el usuario termina de hacer scroll manual
  onScrollEnd(): void {
    const el: HTMLElement = this.monthsScrollRef?.nativeElement;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== this.currentIndex) {
      this.currentIndex = idx;
      this.loadMonth(idx);
      // Pre-cargar adyacentes
      this.loadMonth(idx - 1);
      this.loadMonth(idx + 1);
    }
  }

  prevMonth(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.scrollToIndex(this.currentIndex);
      this.loadMonth(this.currentIndex);
      this.loadMonth(this.currentIndex - 1);
    }
  }

  nextMonth(): void {
    if (this.currentIndex < this.months.length - 1) {
      this.currentIndex++;
      this.scrollToIndex(this.currentIndex);
      this.loadMonth(this.currentIndex);
      this.loadMonth(this.currentIndex + 1);
    }
  }

  get currentSlot() { return this.months[this.currentIndex]; }

  getMonthLabel(m: { year: number; month: number }): string {
    return `${this.MONTH_NAMES[m.month - 1]} ${m.year}`;
  }

  // ── Acciones sobre pagos ───────────────────────────────────────────────────
  async markAsPaid(payment: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Registrar cobro',
      inputs: [
        { name: 'amount', type: 'number', placeholder: 'Monto', value: payment.grossAmount || payment.amount },
        { name: 'method', type: 'text', placeholder: 'Medio (EFECTIVO / TRANSFERENCIA)', value: 'EFECTIVO' },
        { name: 'notes', type: 'text', placeholder: 'Notas (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cobrado ✓',
          handler: (data) => {
            this.http.patch<any>(`${this.apiUrl}/payments/${payment.id}/saldo`, {
              status: 'APROBADO', amount: parseFloat(data.amount), method: data.method?.trim() || 'EFECTIVO', notes: data.notes || undefined,
            }).subscribe({
              next: () => { this.toast('Pago registrado', 'success'); this.invalidateMonth(this.currentIndex); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async markAsDebt(payment: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Marcar como deuda',
      message: `¿Confirmar deuda de $${payment.grossAmount || payment.amount}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar deuda',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.http.patch<any>(`${this.apiUrl}/payments/${payment.id}/saldo`, { status: 'DEUDA' }).subscribe({
              next: () => { this.toast('Marcado como deuda', 'warning'); this.invalidateMonth(this.currentIndex); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  private invalidateMonth(idx: number): void {
    if (this.months[idx]) {
      this.months[idx].data = null;
      this.loadMonth(idx);
    }
  }

  private async toast(msg: string, color = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color, position: 'bottom' });
    await t.present();
  }

  // ── Helpers de formato ────────────────────────────────────────────────────
  formatPrice(n: number): string { return '$' + Math.round(n).toLocaleString('es-AR'); }
  formatDate(d: string): string {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  formatTime(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  getStatusColor(s: string): string {
    return { APROBADO:'success', PENDIENTE:'warning', DEUDA:'danger', RECHAZADO:'medium', REEMBOLSADO:'medium' }[s] ?? 'medium';
  }
  getStatusLabel(s: string): string {
    return { APROBADO:'Cobrado', PENDIENTE:'Pendiente', DEUDA:'Deuda', RECHAZADO:'Rechazado', REEMBOLSADO:'Reembolsado' }[s] ?? s;
  }
  getTypeLabel(t: string): string {
    return { SENA:'Seña', SALDO:'Saldo', AJUSTE:'Ajuste' }[t] ?? t;
  }
  getMethodLabel(m: string): string {
    return { MERCADOPAGO:'MercadoPago', EFECTIVO:'Efectivo', TRANSFERENCIA:'Transferencia', TARJETA_LOCAL:'Tarjeta' }[m] ?? m;
  }
}
