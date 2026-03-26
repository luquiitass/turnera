import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';

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
  currentStep = 1;
  totalSteps = 4;

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

  // Step 5 – Success
  showSuccess = false;
  bookingId = '';

  readonly appName = environment.appName;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
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

    this.loadServices();
  }

  // ──────────────────────────────────────────────
  // Navigation
  // ──────────────────────────────────────────────

  get progressValue(): number {
    return this.currentStep / this.totalSteps;
  }

  get canGoNext(): boolean {
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
    if (this.currentStep === 4) {
      this.confirmBooking();
      return;
    }
    this.currentStep++;
    if (this.currentStep === 2 && this.barbers.length === 0) {
      this.loadBarbers();
    }
  }

  goPrev(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // ──────────────────────────────────────────────
  // Step 1 – Load services
  // ──────────────────────────────────────────────

  loadServices(): void {
    this.servicesLoading = true;
    this.servicesError = '';
    this.apiService.getServices().subscribe({
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
    if (Array.isArray(data)) {
      return data.map((s: any) => ({
        time: s.time ?? s.startTime ?? s,
        available: s.available !== undefined ? s.available : s.isAvailable ?? true,
      }));
    }
    return [];
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
      serviceId: this.selectedService.id,
      barberId: this.selectedBarber.id,
      date: this.selectedDate,
      startTime: this.selectedTime,
      notes: this.notes.trim() || undefined,
    };

    this.apiService.createBooking(payload).subscribe({
      next: (res) => {
        this.confirmLoading = false;
        this.bookingId = res?.data?.id ?? res?.id ?? '';
        this.showSuccess = true;
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
    const labels: Record<number, string> = {
      1: 'Servicio',
      2: 'Barbero',
      3: 'Fecha y hora',
      4: 'Confirmacion',
    };
    return labels[step] ?? '';
  }
}
