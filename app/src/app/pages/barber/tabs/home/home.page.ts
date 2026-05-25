import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-barber-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class BarberHomePage implements OnInit {
  barberId: string | null = null;
  barberName = '';
  todayDate = new Date();
  todayBookings: any[] = [];
  isLoading = false;
  error = false;

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadBarberProfile();
  }

  ionViewWillEnter(): void {
    this.loadBarberProfile();
  }

  loadBarberProfile(): void {
    this.isLoading = true;
    this.error = false;

    this.http.get<any>(`${environment.apiUrl}/barbers/my-profile`).subscribe({
      next: (res) => {
        const profiles: any[] = Array.isArray(res.data) ? res.data : [];
        if (profiles.length > 0) {
          this.barberId = profiles[0].id;
          const user = this.authService.currentUser;
          this.barberName = user ? `${user.firstName} ${user.lastName}` : 'Barbero';
          this.loadTodayBookings();
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.error = true;
        this.isLoading = false;
      },
    });
  }

  loadTodayBookings(): void {
    if (!this.barberId) {
      this.isLoading = false;
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const params = new HttpParams()
      .set('barberId', this.barberId)
      .set('date', today);

    this.http.get<any>(`${environment.apiUrl}/bookings`, { params }).subscribe({
      next: (res) => {
        const bookings = Array.isArray(res.data) ? res.data : res.data?.data || [];
        this.todayBookings = bookings
          .filter((b: any) => b.barberId === this.barberId)
          .sort((a: any, b: any) => {
            const timeA = a.startTime ?? a.time ?? '';
            const timeB = b.startTime ?? b.time ?? '';
            return timeA.localeCompare(timeB);
          });
        this.isLoading = false;
      },
      error: () => {
        this.todayBookings = [];
        this.isLoading = false;
      },
    });
  }

  formatToday(): string {
    return this.todayDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  getClientName(booking: any): string {
    if (booking.user) {
      return `${booking.user.firstName ?? ''} ${booking.user.lastName ?? ''}`.trim();
    }
    return 'Cliente';
  }

  getServiceName(booking: any): string {
    return booking.service?.name ?? booking.serviceName ?? 'Servicio';
  }

  getBookingTime(booking: any): string {
    return booking.startTime ?? booking.time ?? '--:--';
  }

  goToAllBookings(): void {
    this.router.navigateByUrl('/barber/tabs/bookings');
  }
}
