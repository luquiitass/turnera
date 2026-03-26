import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { BarbershopsService } from '../../services/barbershops.service';
import { ServicesService } from '../../services/services.service';
import { SchedulesService } from '../../services/schedules.service';
import { BookingsService } from '../../services/bookings.service';
import { Barbershop, Service, FlatService, Barber, TimeSlot, Booking } from '../../shared/models';

type BookingMode = 'select' | 'by-date' | 'by-barbershop' | 'by-barber' | 'by-service';

interface StepDef {
  id: string;
  title: string;
}

@Component({
  standalone: false,
  selector: 'app-booking-flow',
  templateUrl: './booking-flow.page.html',
  styleUrls: ['./booking-flow.page.scss'],
})
export class BookingFlowPage implements OnInit {
  mode: BookingMode = 'select';
  currentStepIndex = 0;
  steps: StepDef[] = [];

  allBarbershops: Barbershop[] = [];
  loadedBarbershops: Barbershop[] = []; // fully loaded with barbers/services
  selectedBarbershop: Barbershop | null = null;
  availableBarbers: Barber[] = [];
  availableServices: FlatService[] = [];
  timeSlots: TimeSlot[] = [];

  // For by-date mode: services grouped by barbershop
  dateFilteredResults: { barbershop: Barbershop; services: FlatService[]; barbers: Barber[] }[] = [];
  selectedHourFilter = ''; // optional hour filter in by-date mode

  selectedBarber: Barber | null = null;
  selectedService: FlatService | null = null;
  selectedDate = '';
  selectedTimeSlot: TimeSlot | null = null;
  notes = '';

  isLoading = false;
  confirmedBooking: Booking | null = null;

  minDate = new Date().toISOString();
  maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private barbershopsService: BarbershopsService,
    private servicesService: ServicesService,
    private schedulesService: SchedulesService,
    private bookingsService: BookingsService,
    private toastController: ToastController,
  ) {}

  ngOnInit(): void {
    const barbershopId = this.route.snapshot.queryParamMap.get('barbershopId');
    const barberId = this.route.snapshot.queryParamMap.get('barberId');

    if (barbershopId) {
      this.loadBarbershop(barbershopId).then(() => {
        if (barberId) {
          this.selectedBarber = this.availableBarbers.find(b => b.id === barberId) || null;
          this.setMode('by-barber');
        } else {
          this.setMode('by-barbershop');
        }
      });
    }
  }

  // ==================== MODE & STEPS ====================

  setMode(mode: BookingMode): void {
    this.mode = mode;
    this.currentStepIndex = 0;

    switch (mode) {
      case 'by-date':
        this.steps = [
          { id: 'date-explore', title: 'Fecha y hora' },
          { id: 'pick-service-global', title: 'Elegir servicio' },
          { id: 'pick-barbershop-for-service', title: 'Elegir barberia' },
          { id: 'barber', title: 'Elegir barbero' },
          { id: 'time', title: 'Elegir hora' },
          { id: 'confirm', title: 'Confirmar reserva' },
        ];
        break;
      case 'by-barbershop':
        this.steps = [
          { id: 'barber', title: 'Elegir barbero' },
          { id: 'date', title: 'Elegir fecha' },
          { id: 'service', title: 'Elegir servicio' },
          { id: 'time', title: 'Elegir hora' },
          { id: 'confirm', title: 'Confirmar reserva' },
        ];
        break;
      case 'by-barber':
        this.steps = [
          { id: 'date', title: 'Elegir fecha' },
          { id: 'service', title: 'Elegir servicio' },
          { id: 'time', title: 'Elegir hora' },
          { id: 'confirm', title: 'Confirmar reserva' },
        ];
        break;
      case 'by-service':
        this.steps = [
          { id: 'all-services', title: 'Elegir servicio' },
          { id: 'pick-barbershop-for-service', title: 'Elegir barberia' },
          { id: 'barber', title: 'Elegir barbero' },
          { id: 'date', title: 'Elegir fecha' },
          { id: 'time', title: 'Elegir hora' },
          { id: 'confirm', title: 'Confirmar reserva' },
        ];
        break;
    }
  }

  get currentStep(): StepDef | null {
    return this.steps[this.currentStepIndex] || null;
  }

  get isSuccess(): boolean {
    return this.confirmedBooking !== null;
  }

  get progress(): number {
    if (this.isSuccess) return 1;
    return this.steps.length > 0 ? (this.currentStepIndex + 1) / this.steps.length : 0;
  }

  // ==================== NAVIGATION ====================

  canGoNext(): boolean {
    const step = this.currentStep;
    if (!step) return false;
    switch (step.id) {
      case 'date-explore': return this.selectedDate !== '';
      case 'pick-service-global': return this.selectedService !== null;
      case 'all-services': return this.selectedService !== null;
      case 'pick-barbershop-for-service': return this.selectedBarbershop !== null;
      case 'barbershop-pick': return this.selectedBarbershop !== null;
      case 'date': return this.selectedDate !== '';
      case 'barber': return this.selectedBarber !== null;
      case 'service': return this.selectedService !== null;
      case 'time': return this.selectedTimeSlot !== null;
      case 'confirm': return true;
      default: return false;
    }
  }

  goNext(): void {
    if (!this.canGoNext()) return;
    this.currentStepIndex++;
    if (this.currentStepIndex < this.steps.length) {
      this.prepareStep(this.steps[this.currentStepIndex].id);
      this.tryAutoSkip();
    }
  }

  private tryAutoSkip(): void {
    const step = this.currentStep;
    if (!step || step.id === 'confirm') return;

    if (step.id === 'barber') {
      this.filterBarbersForStep();
      if (this.availableBarbers.length === 1) {
        this.selectedBarber = this.availableBarbers[0];
        this.currentStepIndex++;
        if (this.currentStepIndex < this.steps.length) {
          this.prepareStep(this.steps[this.currentStepIndex].id);
          this.tryAutoSkip();
        }
      }
    } else if (step.id === 'service') {
      this.filterServicesForBarber();
      if (this.availableServices.length === 1) {
        this.selectedService = this.availableServices[0];
        this.currentStepIndex++;
        if (this.currentStepIndex < this.steps.length) {
          this.prepareStep(this.steps[this.currentStepIndex].id);
          this.tryAutoSkip();
        }
      }
    } else if (step.id === 'pick-barbershop-for-service') {
      if (this.dateFilteredResults.length === 1) {
        this.pickBarbershopForService(this.dateFilteredResults[0].barbershop);
        this.currentStepIndex++;
        if (this.currentStepIndex < this.steps.length) {
          this.prepareStep(this.steps[this.currentStepIndex].id);
          this.tryAutoSkip();
        }
      }
    }
  }

  goPrev(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      // Skip auto-assigned steps backwards
      const step = this.currentStep;
      if (step?.id === 'barber' && this.availableBarbers.length === 1) {
        this.selectedBarber = null;
        if (this.currentStepIndex > 0) this.currentStepIndex--;
      } else if (step?.id === 'service' && this.availableServices.length === 1) {
        this.selectedService = null;
        if (this.currentStepIndex > 0) this.currentStepIndex--;
      } else if (step?.id === 'pick-barbershop-for-service' && this.dateFilteredResults.length === 1) {
        this.selectedBarbershop = null;
        if (this.currentStepIndex > 0) this.currentStepIndex--;
      }
    } else {
      this.goBack();
    }
  }

  goBack(): void {
    if (this.mode !== 'select') {
      this.resetSelections();
      this.mode = 'select';
    } else {
      this.router.navigate(['/tabs/home']);
    }
  }

  resetSelections(): void {
    this.currentStepIndex = 0;
    this.steps = [];
    this.selectedBarber = null;
    this.selectedService = null;
    this.selectedDate = '';
    this.selectedTimeSlot = null;
    this.timeSlots = [];
    this.confirmedBooking = null;
    this.notes = '';
    if (this.mode === 'by-date' || this.mode === 'by-service') {
      this.selectedBarbershop = null;
      this.availableBarbers = [];
      this.availableServices = [];
    }
  }

  // ==================== DATA LOADING ====================

  prepareStep(stepId: string): void {
    switch (stepId) {
      case 'browse-services':
        this.loadServicesForDate();
        break;
      case 'pick-service-global':
        this.loadAllServices();
        break;
      case 'all-services':
        this.loadAllServices();
        break;
      case 'pick-barbershop-for-service':
        // dateFilteredResults already loaded by selectGlobalService
        break;
      case 'barber':
        this.filterBarbersForStep();
        break;
      case 'time':
        if (this.selectedBarber && this.selectedDate) this.loadAvailability();
        break;
      case 'service':
        this.filterServicesForBarber();
        break;
      case 'barbershop-pick':
        if (this.allBarbershops.length === 0) this.loadAllBarbershops();
        break;
    }
  }

  loadAllBarbershops(): void {
    this.isLoading = true;
    this.barbershopsService.getAll({ limit: 100 }).subscribe({
      next: (res) => { this.allBarbershops = res.data.data; this.isLoading = false; },
      error: () => { this.isLoading = false; },
    });
  }

  loadBarbershop(id: string): Promise<void> {
    return new Promise((resolve) => {
      this.isLoading = true;
      this.barbershopsService.getOne(id).subscribe({
        next: (res) => {
          this.selectedBarbershop = res.data;
          this.availableBarbers = res.data.barbers?.filter(b => b.isActive) || [];
          // Map BarbershopService[] to flat Service-like objects with price/duration
          this.availableServices = (res.data.services || [])
            .filter((bs: any) => bs.isActive)
            .map((bs: any) => ({
              id: bs.service?.id || bs.serviceId,
              name: bs.service?.name || '',
              description: bs.service?.description || '',
              category: bs.service?.category || '',
              price: bs.price,
              durationMin: bs.durationMin,
              isActive: true,
            }));
          this.isLoading = false;
          resolve();
        },
        error: () => { this.isLoading = false; resolve(); },
      });
    });
  }

  // Load all barbershops fully to show their services for the selected date
  loadServicesForDate(): void {
    this.isLoading = true;
    this.dateFilteredResults = [];

    // Load all barbershops with full detail
    this.barbershopsService.getAll({ limit: 100 }).subscribe({
      next: (res) => {
        const barbershops = res.data.data;
        let loaded = 0;
        const results: { barbershop: Barbershop; services: FlatService[]; barbers: Barber[] }[] = [];

        if (barbershops.length === 0) {
          this.isLoading = false;
          return;
        }

        for (const bs of barbershops) {
          this.barbershopsService.getOne(bs.id).subscribe({
            next: (detail) => {
              loaded++;
              const fullBs = detail.data;
              const activeServices = (fullBs.services || [])
                .filter((bs: any) => bs.isActive !== false)
                .map((bs: any) => ({
                  id: bs.service?.id || bs.id,
                  name: bs.service?.name || bs.name || '',
                  description: bs.service?.description || '',
                  category: bs.service?.category || '',
                  price: bs.price,
                  durationMin: bs.durationMin,
                  isActive: true,
                }));
              const activeBarbers = fullBs.barbers?.filter(b => b.isActive) || [];

              if (activeServices.length > 0 && activeBarbers.length > 0) {
                results.push({ barbershop: fullBs, services: activeServices, barbers: activeBarbers });
              }
              if (loaded === barbershops.length) {
                this.dateFilteredResults = results;
                this.isLoading = false;
              }
            },
            error: () => {
              loaded++;
              if (loaded === barbershops.length) {
                this.dateFilteredResults = results;
                this.isLoading = false;
              }
            },
          });
        }
      },
      error: () => { this.isLoading = false; },
    });
  }

  selectServiceFromBrowse(barbershop: Barbershop, service: FlatService): void {
    this.selectedBarbershop = barbershop;
    this.availableBarbers = barbershop.barbers?.filter(b => b.isActive) || [];
    this.availableServices = (barbershop.services || [])
      .filter((bs: any) => bs.isActive !== false)
      .map((bs: any) => ({
        id: bs.service?.id || bs.id,
        name: bs.service?.name || '',
        description: bs.service?.description || '',
        category: bs.service?.category || '',
        price: bs.price,
        durationMin: bs.durationMin,
        isActive: true,
      }));
    this.selectedService = service;
    this.selectedBarber = null;
    this.selectedTimeSlot = null;
    this.timeSlots = [];
  }

  // For by-service mode: global catalog
  globalServices: Service[] = [];

  loadAllServices(): void {
    if (this.globalServices.length > 0) return;
    this.isLoading = true;
    this.servicesService.getAll().subscribe({
      next: (res) => {
        this.globalServices = res.data;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
  }

  selectGlobalService(service: any): void {
    this.selectedService = { ...service, price: 0, durationMin: 0 };
    // Now load barbershops that offer this service
    this.isLoading = true;
    this.servicesService.getOne(service.id).subscribe({
      next: (res: any) => {
        // res.data.barbershops = BarbershopService[] with barbershop included
        this.dateFilteredResults = (res.data.barbershops || []).map((bs: any) => ({
          barbershop: bs.barbershop,
          services: [{ ...service, price: bs.price, durationMin: bs.durationMin }],
          barbers: [],
        }));
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
  }

  // Group allServiceResults by service name for display
  onHourFilterChange(hour: string): void {
    this.selectedHourFilter = hour;
  }

  get filterHours(): string[] {
    const hours: string[] = [];
    for (let h = 8; h <= 21; h++) {
      hours.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return hours;
  }

  filterBarbersForStep(): void {
    if (!this.selectedBarbershop?.barbers) return;
    let barbers = this.selectedBarbershop.barbers.filter(b => b.isActive);
    // If a service is already selected, filter barbers that offer it
    if (this.selectedService) {
      const sId = this.selectedService.id;
      barbers = barbers.filter(b => {
        if (!b.services || b.services.length === 0) return true; // no assigned = all
        return b.services.some(bs => bs.serviceId === sId);
      });
    }
    this.availableBarbers = barbers;
  }

  filterServicesForBarber(): void {
    if (!this.selectedBarbershop?.services) return;
    // Map BarbershopService to flat objects
    const allActive = (this.selectedBarbershop.services as any[])
      .filter((bs: any) => bs.isActive !== false)
      .map((bs: any) => ({
        id: bs.service?.id || bs.serviceId || bs.id,
        name: bs.service?.name || bs.name || '',
        description: bs.service?.description || bs.description || '',
        category: bs.service?.category || bs.category || '',
        price: bs.price,
        durationMin: bs.durationMin,
        isActive: true,
      }));

    if (this.selectedBarber?.services && this.selectedBarber.services.length > 0) {
      const ids = this.selectedBarber.services.map((bs: any) => bs.serviceId);
      this.availableServices = allActive.filter((s: any) => ids.includes(s.id));
    } else {
      this.availableServices = allActive;
    }
  }

  loadAvailability(): void {
    if (!this.selectedBarber || !this.selectedDate) return;
    this.isLoading = true;
    this.timeSlots = [];
    this.selectedTimeSlot = null;
    this.schedulesService.getAvailability(
      this.selectedBarber.id, this.selectedDate, this.selectedService?.id,
    ).subscribe({
      next: (res) => { this.timeSlots = res.data; this.isLoading = false; },
      error: () => { this.isLoading = false; },
    });
  }

  // ==================== SELECTIONS ====================

  selectMode(mode: BookingMode): void {
    this.setMode(mode);
    if (mode === 'by-service') {
      this.loadAllServices();
    }
  }

  pickBarbershop(bs: Barbershop): void {
    this.loadBarbershop(bs.id);
  }

  pickBarbershopForService(bs: any): void {
    this.loadBarbershop(bs.id).then(() => {
      this.updateServiceWithBarbershopPrice();
    });
  }

  private updateServiceWithBarbershopPrice(): void {
    if (!this.selectedService || !this.selectedBarbershop?.services) return;
    const bsService = (this.selectedBarbershop.services as any[]).find(
      (bs: any) => (bs.service?.id || bs.serviceId) === this.selectedService!.id
    );
    if (bsService) {
      this.selectedService = {
        ...this.selectedService,
        price: bsService.price,
        durationMin: bsService.durationMin,
      };
    }
  }

  selectBarber(barber: Barber): void {
    this.selectedBarber = barber;
    this.selectedTimeSlot = null;
    this.timeSlots = [];
  }

  selectService(service: FlatService): void {
    this.selectedService = service;
    this.selectedTimeSlot = null;
    this.timeSlots = [];
  }

  onDateChange(event: any): void {
    const rawValue: string = event.detail?.value || '';
    if (!rawValue) return;
    this.selectedDate = rawValue.substring(0, 10);
    this.selectedTimeSlot = null;
    this.timeSlots = [];
  }

  selectTimeSlot(slot: TimeSlot): void {
    if (!slot.available) return;
    this.selectedTimeSlot = slot;
  }

  // ==================== CONFIRM ====================

  confirmBooking(): void {
    if (!this.selectedBarber || !this.selectedService || !this.selectedDate || !this.selectedTimeSlot) return;
    this.isLoading = true;
    this.bookingsService.create({
      barberId: this.selectedBarber.id,
      serviceId: this.selectedService.id,
      date: this.selectedDate,
      startTime: this.selectedTimeSlot.time,
      notes: this.notes || undefined,
    }).subscribe({
      next: (res) => { this.confirmedBooking = res.data; this.isLoading = false; },
      error: (err: any) => {
        const msg = err?.error?.error?.message || 'No se pudo completar la reserva';
        this.showToast(msg, 'danger');
        this.isLoading = false;
      },
    });
  }

  goToMyBookings(): void { this.router.navigate(['/tabs/my-bookings']); }
  goHome(): void { this.router.navigate(['/tabs/home']); }

  // ==================== HELPERS ====================

  formatPrice(amount: number): string { return '$' + amount.toLocaleString('es-AR'); }
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'bottom' });
    await toast.present();
  }
}
