import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ActiveContextService } from '../../../core/active-context.service';
import { BookingsService } from '../../../services/bookings.service';
import { BarbershopsService } from '../../../services/barbershops.service';
import { User, Booking } from '../../../shared/models';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  currentUser: User | null = null;
  activeRole = 'USUARIO';
  upcomingBookings: Booking[] = [];
  isLoading = false;

  // Admin General dashboard
  platformDashboard: any = null;

  // Admin Barbershop dashboard (barbería seleccionada)
  barbershopDashboard: any = null;
  barbershopName = '';

  private userSub!: Subscription;
  private roleSub!: Subscription;

  constructor(
    private authService: AuthService,
    public activeCtx: ActiveContextService,
    private bookingsService: BookingsService,
    private barbershopsService: BarbershopsService,
    private http: HttpClient,
    private alertCtrl: AlertController,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.roleSub = this.authService.activeRole$.subscribe(role => {
      this.activeRole = role;
      this.loadDataForRole(role);
    });
    // Recargar cuando cambia la barbería seleccionada
    this.activeCtx.context$.subscribe(() => {
      if (this.isAdminBarbershop) this.loadBarbershopDashboard();
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.roleSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.loadDataForRole(this.activeRole);
  }

  doRefresh(event: any): void {
    this.loadDataForRole(this.activeRole);
    setTimeout(() => event?.target?.complete(), 1000);
  }

  loadDataForRole(role: string): void {
    if (role === 'USUARIO') {
      this.loadUpcomingBookings();
    } else if (role === 'ADMIN_GENERAL') {
      this.loadPlatformDashboard();
    } else if (role === 'ADMIN_BARBERSHOP' || role === 'SUB_ADMIN') {
      this.loadBarbershopDashboard();
    }
  }

  get isUsuario(): boolean {
    return this.activeRole === 'USUARIO';
  }

  get isAdminBarbershop(): boolean {
    return this.activeRole === 'ADMIN_BARBERSHOP' || this.activeRole === 'SUB_ADMIN';
  }

  get isAdminGeneral(): boolean {
    return this.activeRole === 'ADMIN_GENERAL';
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos dias';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  loadUpcomingBookings(): void {
    this.isLoading = true;
    const today = new Date().toISOString().split('T')[0];
    this.bookingsService
      .getMyBookings({ status: 'CONFIRMADA', from: today, page: 1 })
      .subscribe({
        next: res => {
          this.upcomingBookings = res.data.data.slice(0, 3);
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        },
      });
  }

  loadPlatformDashboard(): void {
    this.isLoading = true;
    this.http.get<any>(`${environment.apiUrl}/stats/platform/dashboard`).subscribe({
      next: (res) => {
        this.platformDashboard = res.data;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
  }

  loadBarbershopDashboard(): void {
    // El template muestra app-barbershop-profile inline usando activeCtx.barbershopId
  }

  goToSearch(): void {
    this.router.navigate(['/admin/tabs/search']);
  }

  goToNewBooking(): void {
    this.router.navigate(['/admin/booking-flow']);
  }

  async generateRegistrationOrder(): Promise<void> {
    this.http.post<any>(`${environment.apiUrl}/registration/create-order`, { expiresInDays: 7 }).subscribe({
      next: async (res: any) => {
        const code = res.data.code;
        const link = `http://localhost:8200/auth/login?redirect=create-barber&code=${code}`;
        const alert = await this.alertCtrl.create({
          header: 'Orden generada',
          message: `Codigo: ${code}\n\nComparti este enlace:`,
          inputs: [{ name: 'link', type: 'url', value: link }],
          buttons: [
            {
              text: 'Copiar enlace',
              handler: () => {
                navigator.clipboard.writeText(link);
                return false;
              },
            },
            { text: 'Cerrar' },
          ],
        });
        await alert.present();
      },
      error: async () => {
        const alert = await this.alertCtrl.create({ header: 'Error', message: 'No se pudo generar la orden', buttons: ['OK'] });
        await alert.present();
      },
    });
  }

  goToAdminPanel(): void {
    this.router.navigate(['/admin/barbershop-panel']);
  }

  goToPlatformPanel(): void {
    this.router.navigate(['/admin/platform']);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      CONFIRMED: 'Confirmada',
      PENDING: 'Pendiente',
      CANCELLED: 'Cancelada',
      COMPLETED: 'Completada',
      NO_SHOW: 'No asistio',
    };
    return labels[status] ?? status;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      CONFIRMED: 'success',
      PENDING: 'warning',
      CANCELLED: 'danger',
      COMPLETED: 'medium',
      NO_SHOW: 'dark',
    };
    return colors[status] ?? 'medium';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
