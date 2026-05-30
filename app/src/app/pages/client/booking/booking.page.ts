import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/client-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { BarbershopResolverService } from '../../../core/barbershop-resolver.service';
import { environment } from '../../../../environments/environment';

interface SelectedService {
  id: string;
  name: string;
  price: number;
  durationMin: number;
}

interface SelectedBarber {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

@Component({
  selector: 'app-booking',
  templateUrl: './booking.page.html',
  styleUrls: ['./booking.page.scss'],
  standalone: false,
})
export class BookingPage implements OnInit {
  // Step control
  needsBarbershopSelection = false;  // true cuando no hay barbershopId fijo
  currentStep = 1;
  get totalSteps(): number { return this.needsBarbershopSelection ? 5 : 4; }

  // Step 2b — Barbershop selection (solo en modo sin barbershopId)
  barbershops: any[] = [];
  barbershopsLoading = false;
  selectedBarbershop: any = null;

  // Step 1 – Services
  services: any[] = [];
  servicesLoading = false;
  servicesError = '';
  selectedService: SelectedService | null = null;

  // Step 2 – Barbers
  barbers: any[] = [];
  filteredBarbers: any[] = [];
  barbersLoading = false;
  barbersError = '';
  selectedBarber: SelectedBarber | null = null;

  // Step 3 – Date & Time
  minDate: string = '';
  maxDate: string = '';
  selectedDate: string = '';
  availabilityLoading = false;
  availabilityError = '';
  timeSlots: TimeSlot[] = [];
  selectedTime: string = '';

  // Step 4 – Confirm
  notes = '';
  confirmLoading = false;
  confirmError = '';

  // Step 5 – Payment (modelo 3)
  showPayment = false;
  paymentLoading = false;
  depositAmount = 0;
  mpInitPoint = '';

  // Step 6 – Success
  showSuccess = false;
  bookingId = '';

  // Plan de la barbería (se carga al init)
  barbershopPlan = 'GRATUITO';

  readonly appName = environment.appName;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private resolverService: BarbershopResolverService,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated) {
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      return;
    }

    const today = new Date();
    this.minDate = this.toIsoDate(today);
    const maxDay = new Date(today);
    maxDay.setDate(maxDay.getDate() + 90);
    this.maxDate = this.toIsoDate(maxDay);

    // Leer barbershopId: primero URL real, luego snapshot, luego resolver, luego environment
    const urlParams = new URLSearchParams(window.location.search);
    const paramBsId = urlParams.get('barbershopId')
                   || this.route.snapshot.queryParamMap.get('barbershopId')
                   || this.resolverService.barbershop?.id
                   || '';

    if (paramBsId) {
      environment.barbershopId = paramBsId;
    } else {
      this.needsBarbershopSelection = true;
    }

    // Cargar plan de la barbería
    if (this.resolverService.barbershop?.id === paramBsId) {
      this.barbershopPlan = this.resolverService.barbershop.subscription?.plan ?? 'GRATUITO';
    } else if (environment.barbershopId) {
      this.apiService.getBarbershop().subscribe({
        next: (res: any) => {
          const bs = res?.data ?? res;
          this.barbershopPlan = bs?.subscription?.plan ?? 'GRATUITO';
        },
      });
    }

    this.loadServices();

    // Manejar retorno desde MercadoPago
    this.route.queryParams.subscribe(params => {
      if (params['status'] === 'success' && params['bookingId']) {
        this.bookingId = params['bookingId'];
        this.showSuccess = true;
        this.showPayment = false;
      } else if (params['status'] === 'failure') {
        this.confirmError = 'El pago fue rechazado. Podés intentarlo nuevamente.';
        this.showPayment = true;
      }
    });
  }

  // ──────────────────────────────────────────────
  // Navigation
  // ──────────────────────────────────────────────

  get progressValue(): number {
    return this.currentStep / this.totalSteps;
  }

  get canGoNext(): boolean {
    if (this.needsBarbershopSelection) {
      switch (this.currentStep) {
        case 1: return !!this.selectedService;
        case 2: return !!this.selectedBarbershop;
        case 3: return !!this.selectedBarber;
        case 4: return !!this.selectedDate && !!this.selectedTime;
        case 5: return true;
        default: return false;
      }
    }
    switch (this.currentStep) {
      case 1: return !!this.selectedService;
      case 2: return !!this.selectedBarber;
      case 3: return !!this.selectedDate && !!this.selectedTime;
      case 4: return true;
      default: return false;
    }
  }

  goNext(): void {
    if (!this.canGoNext) return;

    if (this.needsBarbershopSelection) {
      if (this.currentStep === 1) {
        // Servicio seleccionado → cargar barberías que lo ofrecen
        this.currentStep = 2;
        this.loadBarbershopsForService();
        return;
      }
      if (this.currentStep === 2) {
        // Barbería seleccionada → configurar y cargar barberos
        environment.barbershopId = this.selectedBarbershop.id;
        this.barbershopPlan = this.selectedBarbershop.subscription?.plan ?? 'GRATUITO';
        this.currentStep = 3;
        this.loadBarbers();
        return;
      }
      if (this.currentStep === 3) { this.currentStep = 4; if (!this.selectedDate) { this.selectedDate = this.minDate; this.loadAvailability(); } return; }
      if (this.currentStep === 4) { this.currentStep = 5; return; }
      if (this.currentStep === 5) { this.confirmBooking(); return; }
    }

    if (this.currentStep === 4) { this.confirmBooking(); return; }
    this.currentStep++;
    if (this.currentStep === 2 && this.barbers.length === 0) this.loadBarbers();
    if (this.currentStep === 3 && !this.selectedDate) { this.selectedDate = this.minDate; this.loadAvailability(); }
  }

  goPrev(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  // ── Barbershop by service ─────────────────────────────────────────────────
  loadBarbershopsForService(): void {
    if (!this.selectedService) return;
    this.barbershopsLoading = true;
    this.barbershops = [];
    // Busca barberías que ofrezcan el servicio seleccionado
    const q = encodeURIComponent(this.selectedService.name);
    const apiUrl = environment.apiUrl;
    fetch(`${apiUrl}/barbershops/search?q=${q}`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then(r => r.json())
      .then((res: any) => {
        const data = res?.data ?? res ?? [];
        this.barbershops = Array.isArray(data) ? data : (data.data ?? []);
        this.barbershopsLoading = false;
      })
      .catch(() => { this.barbershopsLoading = false; });
  }

  selectBarbershop(bs: any): void { this.selectedBarbershop = bs; }
  isBarbershopSelected(bs: any): boolean { return this.selectedBarbershop?.id === bs.id; }

  getBarbershopImage(bs: any): string {
    const imgs: any[] = bs.images ?? [];
    return imgs.find((i: any) => i.image?.type === 'PORTADA')?.image?.url
      || imgs.find((i: any) => i.image?.type === 'ICONO')?.image?.url
      || bs.logoImage || '';
  }

  // ──────────────────────────────────────────────
  // Step 1 – Load services
  // ──────────────────────────────────────────────

  loadServices(): void {
    this.servicesLoading = true;
    this.servicesError = '';
    const obs = this.needsBarbershopSelection
      ? this.apiService.getGlobalServices()
      : this.apiService.getServices();
    obs.subscribe({
      next: (res) => {
        this.services = res?.data ?? res ?? [];
        this.servicesLoading = false;
      },
      error: () => {
        this.servicesError = 'No se pudieron cargar los servicios. Intente nuevamente.';
        this.servicesLoading = false;
      },
    });
  }

  selectService(s: any): void {
    this.selectedService = {
      id: s.service?.id || s.serviceId || s.id,
      name: s.service?.name || s.name || '',
      price: s.price,
      durationMin: s.durationMin,
    };
    this.selectedBarber = null;
    this.selectedDate = '';
    this.selectedTime = '';
    this.timeSlots = [];
    this.barbers = [];
  }

  isServiceSelected(s: any): boolean {
    const id = s.service?.id || s.serviceId || s.id;
    return this.selectedService?.id === id;
  }

  // ──────────────────────────────────────────────
  // Step 2 – Load & filter barbers
  // ──────────────────────────────────────────────

  loadBarbers(): void {
    this.barbersLoading = true;
    this.barbersError = '';
    this.apiService.getBarbers().subscribe({
      next: (res) => {
        this.barbers = res?.data ?? res ?? [];
        this.filteredBarbers = this.filterBarbersByService(this.barbers);
        this.barbersLoading = false;

        // Auto-select if only 1 barber
        if (this.filteredBarbers.length === 1) {
          this.selectBarber(this.filteredBarbers[0]);
          this.currentStep = 3;
          this.selectedDate = this.minDate;
          this.loadAvailability();
        }
      },
      error: () => {
        this.barbersError = 'No se pudieron cargar los barberos. Intente nuevamente.';
        this.barbersLoading = false;
      },
    });
  }

  filterBarbersByService(barbers: any[]): any[] {
    if (!this.selectedService) return barbers;
    return barbers.filter((b) => {
      const services: any[] = b.services ?? [];
      // If services array is empty, barber offers all services
      if (services.length === 0) return true;
      return services.some(
        (bs: any) =>
          (bs.serviceId || bs.service?.id || bs.id) === this.selectedService!.id,
      );
    });
  }

  selectBarber(b: any): void {
    this.selectedBarber = {
      id: b.id,
      firstName: b.firstName || b.user?.firstName || '',
      lastName: b.lastName || b.user?.lastName || '',
      avatarUrl: b.avatarUrl || b.user?.avatarUrl,
    };
    // Reset time selection
    this.selectedDate = '';
    this.selectedTime = '';
    this.timeSlots = [];
  }

  isBarberSelected(b: any): boolean {
    return this.selectedBarber?.id === b.id;
  }

  // ──────────────────────────────────────────────
  // Step 3 – Date & time
  // ──────────────────────────────────────────────

  onDateChange(event: any): void {
    const raw: string = event?.detail?.value ?? event;
    // ion-datetime may return full ISO string; keep only date portion
    this.selectedDate = raw.substring(0, 10);
    this.selectedTime = '';
    this.loadAvailability();
  }

  loadAvailability(): void {
    if (!this.selectedBarber || !this.selectedDate) return;
    this.availabilityLoading = true;
    this.availabilityError = '';
    this.timeSlots = [];

    this.apiService
      .getAvailability(this.selectedBarber.id, this.selectedDate, this.selectedService?.id)
      .subscribe({
        next: (res) => {
          const raw = res?.data ?? res ?? [];
          this.timeSlots = this.normalizeSlots(raw);
          this.availabilityLoading = false;
        },
        error: () => {
          this.availabilityError = 'No se pudo cargar la disponibilidad. Intente nuevamente.';
          this.availabilityLoading = false;
        },
      });
  }

  normalizeSlots(data: any): TimeSlot[] {
    if (!Array.isArray(data)) return [];

    const now = new Date();
    const isToday = this.selectedDate === this.toIsoDate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return data.map((s: any) => {
      const time: string = s.time ?? s.startTime ?? s;
      const available: boolean = s.available !== undefined ? s.available : (s.isAvailable ?? true);

      // Si es hoy, deshabilitar slots cuya hora ya pasó
      if (isToday && available) {
        const [h, m] = time.split(':').map(Number);
        return { time, available: (h * 60 + m) > nowMinutes };
      }

      return { time, available };
    });
  }

  selectTime(slot: TimeSlot): void {
    if (!slot.available) return;
    this.selectedTime = slot.time;
  }

  isTimeSelected(slot: TimeSlot): boolean {
    return this.selectedTime === slot.time;
  }

  // ──────────────────────────────────────────────
  // Step 4 – Confirm booking
  // ──────────────────────────────────────────────

  confirmBooking(): void {
    if (!this.selectedService || !this.selectedBarber || !this.selectedDate || !this.selectedTime) {
      return;
    }

    this.confirmLoading = true;
    this.confirmError = '';

    const payload = {
      barbershopId: this.selectedBarbershop?.id ?? environment.barbershopId,
      serviceId: this.selectedService.id,
      barberId: this.selectedBarber.id,
      date: this.selectedDate,
      startTime: this.selectedTime,
      notes: this.notes.trim() || undefined,
    };

    this.apiService.createBooking(payload).subscribe({
      next: (res) => {
        this.confirmLoading = false;
        const booking = res?.data ?? res;
        const bookingId = booking?.id ?? '';

        // Navegar a la página de confirmación standalone (maneja pago y estado)
        this.router.navigateByUrl(`/booking/confirm/${bookingId}`, { replaceUrl: true });
      },
      error: (err) => {
        this.confirmLoading = false;
        this.confirmError =
          err?.error?.error?.message ?? err?.error?.message ?? 'No se pudo confirmar el turno. Intente nuevamente.';
      },
    });
  }

  // ──────────────────────────────────────────────
  // Success navigation
  // ──────────────────────────────────────────────

  loadPaymentPreference(bookingId: string): void {
    this.paymentLoading = true;
    this.apiService.createBookingPreference(bookingId).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        this.depositAmount = data.depositAmount ?? 0;
        this.mpInitPoint  = data.initPoint ?? '';
        this.paymentLoading = false;
        this.showPayment = true;
      },
      error: () => {
        this.paymentLoading = false;
        this.showSuccess = true; // si falla el pago, igual confirmamos la reserva
      },
    });
  }

  payWithMP(): void {
    if (this.mpInitPoint) window.location.href = this.mpInitPoint;
  }

  skipPayment(): void {
    this.showPayment = false;
    this.showSuccess = true;
  }

  goToHome(): void {
    this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
  }

  goToMyBookings(): void {
    this.router.navigateByUrl('/tabs/bookings', { replaceUrl: true });
  }

  newBooking(): void {
    this.currentStep = 1;
    this.showSuccess = false;
    this.selectedService = null;
    this.selectedBarber = null;
    this.selectedDate = '';
    this.selectedTime = '';
    this.timeSlots = [];
    this.notes = '';
    this.bookingId = '';
    this.confirmError = '';
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  formatPrice(amount: number): string {
    if (amount == null) return '';
    return '$' + amount.toLocaleString('es-AR');
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.substring(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getStepLabel(step: number): string {
    if (this.needsBarbershopSelection) {
      const labels: Record<number, string> = { 1: 'Servicio', 2: 'Barbería', 3: 'Barbero', 4: 'Fecha y hora', 5: 'Confirmación' };
      return labels[step] ?? '';
    }
    const labels: Record<number, string> = { 1: 'Servicio', 2: 'Barbero', 3: 'Fecha y hora', 4: 'Confirmacion' };
    return labels[step] ?? '';
  }
}
