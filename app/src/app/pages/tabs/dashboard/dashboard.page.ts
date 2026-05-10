import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BarbershopsService } from '../../../services/barbershops.service';
import { BookingsService } from '../../../services/bookings.service';
import { StatsService } from '../../../services/stats.service';
import { BarbersService } from '../../../services/barbers.service';

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  loading = true;
  error = false;
  lastUpdated = '';

  barbershopId = '';
  barbershopName = '';

  // KPIs
  stats: any = null;

  // Barberos con info del día
  barbers: any[] = [];

  // Reservas de hoy
  todayBookings: any[] = [];
  upcomingBookings: any[] = [];
  pastBookings: any[] = [];

  // Mapa barbero → reservas hoy
  barberBookingsMap: Record<string, any[]> = {};

  today = '';

  constructor(
    private route: ActivatedRoute,
    private barbershopsService: BarbershopsService,
    private bookingsService: BookingsService,
    private statsService: StatsService,
    private barbersService: BarbersService,
  ) {}

  ngOnInit(): void {
    const d = new Date();
    this.today = this.toDateStr(d);
  }

  ionViewWillEnter(): void {
    // Prioridad: query param > barbershopId ya cargado > getMyBarbershops
    const paramId = this.route.snapshot.queryParamMap.get('barbershopId');
    if (paramId && paramId !== this.barbershopId) {
      this.barbershopId = paramId;
      this.barbershopName = '';
    }
    if (this.barbershopId) {
      this.loadAll();
    } else {
      this.loadBarbershop();
    }
  }

  private loadBarbershop(): void {
    this.loading = true;
    this.barbershopsService.getMyBarbershops().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res.data) ? res.data : [];
        if (list.length > 0) {
          this.barbershopId = list[0].id;
          this.barbershopName = list[0].name;
          this.loadAll();
        } else {
          this.loading = false;
          this.error = true;
        }
      },
      error: () => { this.loading = false; this.error = true; },
    });
  }

  loadAll(): void {
    this.loading = true;
    this.error = false;

    forkJoin({
      stats:      this.statsService.getDashboard(this.barbershopId),
      barbershop: this.barbershopsService.getOne(this.barbershopId),
      barbers:    this.barbersService.getByBarbershop(this.barbershopId),
      bookings:   this.bookingsService.getByBarbershop(this.barbershopId, {
        from: this.today,
        to:   this.today,
      }),
    }).subscribe({
      next: (res: any) => {
        const { stats, barbershop, barbers, bookings } = res;
        this.stats = stats?.data ?? stats;
        if (!this.barbershopName) this.barbershopName = barbershop?.data?.name ?? '';

        const barberList: any[] = Array.isArray(barbers?.data)
          ? barbers.data
          : (barbers?.data?.data ?? []);
        this.barbers = barberList.filter((b: any) => b.isActive);

        const bookingList: any[] = Array.isArray(bookings?.data)
          ? bookings.data
          : (bookings?.data?.data ?? []);
        this.todayBookings = bookingList;

        this.buildBarberMap();
        this.splitUpcoming();

        this.lastUpdated = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        this.loading = false;
      },
      error: () => { this.loading = false; this.error = true; },
    });
  }

  doRefresh(event: any): void {
    forkJoin({
      stats:      this.statsService.getDashboard(this.barbershopId),
      barbershop: this.barbershopsService.getOne(this.barbershopId),
      barbers:    this.barbersService.getByBarbershop(this.barbershopId),
      bookings:   this.bookingsService.getByBarbershop(this.barbershopId, {
        from: this.today, to: this.today,
      }),
    }).subscribe({
      next: (res: any) => {
        const { stats, barbershop, barbers, bookings } = res;
        this.stats = stats?.data ?? stats;
        if (!this.barbershopName) this.barbershopName = barbershop?.data?.name ?? '';
        const barberList: any[] = Array.isArray(barbers?.data) ? barbers.data : (barbers?.data?.data ?? []);
        this.barbers = barberList.filter((b: any) => b.isActive);
        const bookingList: any[] = Array.isArray(bookings?.data) ? bookings.data : (bookings?.data?.data ?? []);
        this.todayBookings = bookingList;
        this.buildBarberMap();
        this.splitUpcoming();
        this.lastUpdated = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        event.target.complete();
      },
      error: () => event.target.complete(),
    });
  }

  private buildBarberMap(): void {
    this.barberBookingsMap = {};
    for (const b of this.todayBookings) {
      const bid = b.barber?.id ?? b.barberId;
      if (!bid) continue;
      if (!this.barberBookingsMap[bid]) this.barberBookingsMap[bid] = [];
      this.barberBookingsMap[bid].push(b);
    }
  }

  private splitUpcoming(): void {
    const nowMin = this.nowMinutes();
    const active = ['PENDIENTE', 'CONFIRMADA'];
    const sorted = [...this.todayBookings]
      .filter(b => active.includes(b.status))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    this.upcomingBookings = sorted.filter(b => this.timeToMin(b.startTime) >= nowMin);
    this.pastBookings     = sorted.filter(b => this.timeToMin(b.startTime) < nowMin);
  }

  getBarberBookings(barberId: string): any[] {
    return this.barberBookingsMap[barberId] ?? [];
  }

  getBarberNextBooking(barberId: string): any | null {
    const nowMin = this.nowMinutes();
    const upcoming = (this.barberBookingsMap[barberId] ?? [])
      .filter(b => ['PENDIENTE', 'CONFIRMADA'].includes(b.status) && this.timeToMin(b.startTime) >= nowMin)
      .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
    return upcoming[0] ?? null;
  }

  getBarberConfirmedCount(barberId: string): number {
    return (this.barberBookingsMap[barberId] ?? [])
      .filter(b => ['PENDIENTE', 'CONFIRMADA'].includes(b.status)).length;
  }

  getBarberOccupancy(barberId: string): number {
    const total = 18; // slots estimados de 8 a 20h con 40min cada uno
    const confirmed = this.getBarberConfirmedCount(barberId);
    return Math.min(100, Math.round((confirmed / total) * 100));
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      PENDIENTE: 'warning', CONFIRMADA: 'success',
      CANCELADA: 'medium', COMPLETADA: 'primary', NO_SHOW: 'danger',
    };
    return map[status] ?? 'medium';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada',
      CANCELADA: 'Cancelada', COMPLETADA: 'Completada', NO_SHOW: 'No asistió',
    };
    return map[status] ?? status;
  }

  getInitials(firstName: string, lastName: string): string {
    return `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`;
  }

  formatPrice(n: number): string {
    if (!n) return '$0';
    return '$' + Math.round(n).toLocaleString('es-AR');
  }

  formatTime(t: string): string { return t?.substring(0, 5) ?? ''; }

  formatTodayFull(): string {
    return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private nowMinutes(): number {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  private timeToMin(t: string): number {
    const [h, m] = (t ?? '00:00').split(':').map(Number);
    return h * 60 + m;
  }

  // Colores estables por barbero (basado en hash del id)
  private colorPalette = [
    '#C9A84C','#42A5F5','#4CAF50','#EF5350','#AB47BC',
    '#FF7043','#26C6DA','#D4E157','#EC407A','#7E57C2',
  ];
  getBarberColor(barberId: string): string {
    if (!barberId) return this.colorPalette[0];
    let hash = 0;
    for (let i = 0; i < barberId.length; i++) hash = barberId.charCodeAt(i) + ((hash << 5) - hash);
    return this.colorPalette[Math.abs(hash) % this.colorPalette.length];
  }

  isCurrentlyBusy(barber: any): boolean {
    const nowMin = this.nowMinutes();
    return (this.barberBookingsMap[barber.id] ?? []).some(b => {
      const start = this.timeToMin(b.startTime);
      const end   = this.timeToMin(b.endTime);
      return ['CONFIRMADA', 'PENDIENTE'].includes(b.status) && nowMin >= start && nowMin <= end;
    });
  }
}
