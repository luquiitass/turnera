import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { BookingsService } from '../../../services/bookings.service';
import { Booking } from '../../../shared/models';

type FilterSegment = 'all' | 'upcoming' | 'past';

@Component({
  standalone: false,
  selector: 'app-my-bookings',
  templateUrl: './my-bookings.page.html',
  styleUrls: ['./my-bookings.page.scss'],
})
export class MyBookingsPage implements OnInit {
  bookings: Booking[] = [];
  isLoading = false;
  selectedSegment: FilterSegment = 'upcoming';
  selectedBooking: Booking | null = null;
  showDetail = false;

  constructor(
    private bookingsService: BookingsService,
    private alertController: AlertController,
    private toastController: ToastController,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadBookings();
  }

  ionViewWillEnter(): void {
    this.loadBookings();
  }

  onSegmentChange(event: CustomEvent): void {
    this.selectedSegment = event.detail.value as FilterSegment;
    this.loadBookings();
  }

  loadBookings(): void {
    this.isLoading = true;
    const today = new Date().toISOString().split('T')[0];

    let filters: { status?: string; from?: string; to?: string } = {};

    if (this.selectedSegment === 'upcoming') {
      filters = { from: today };
    } else if (this.selectedSegment === 'past') {
      filters = { to: today };
    }

    this.bookingsService.getMyBookings(filters).subscribe({
      next: (res) => {
        this.bookings = res.data.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  openDetail(booking: Booking): void {
    this.selectedBooking = booking;
    this.showDetail = true;
    // Load full detail
    this.bookingsService.getOne(booking.id).subscribe({
      next: (res) => {
        this.selectedBooking = res.data;
      },
    });
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedBooking = null;
  }

  get canCancel(): boolean {
    if (!this.selectedBooking) return false;
    return ['PENDIENTE', 'CONFIRMADA'].includes(this.selectedBooking.status);
  }

  async confirmCancel(): Promise<void> {
    if (!this.selectedBooking) return;
    const alert = await this.alertController.create({
      header: 'Cancelar reserva',
      message: 'Estas seguro de que quieres cancelar esta reserva?',
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Si, cancelar',
          cssClass: 'danger',
          handler: () => {
            this.cancelBooking();
          },
        },
      ],
    });
    await alert.present();
  }

  cancelBooking(): void {
    if (!this.selectedBooking) return;
    this.bookingsService.cancel(this.selectedBooking.id).subscribe({
      next: () => {
        this.showToast('Reserva cancelada', 'success');
        this.closeDetail();
        this.loadBookings();
      },
      error: (err: any) => {
        const msg = err?.error?.error?.message || 'No se pudo cancelar la reserva';
        this.showToast(msg, 'danger');
      },
    });
  }

  goToNewBooking(): void {
    this.router.navigate(['/booking-flow']);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      CONFIRMADA: 'Confirmada',
      CANCELADA: 'Cancelada',
      COMPLETADA: 'Completada',
      NO_SHOW: 'No asistio',
    };
    return labels[status] ?? status;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      CONFIRMADA: 'success',
      PENDIENTE: 'warning',
      CANCELADA: 'danger',
      COMPLETADA: 'medium',
      NO_SHOW: 'dark',
    };
    return colors[status] ?? 'medium';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatPrice(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }

  get emptyMessage(): string {
    if (this.selectedSegment === 'upcoming') return 'No tienes reservas proximas.';
    if (this.selectedSegment === 'past') return 'No tienes reservas pasadas.';
    return 'No tienes reservas todavia.';
  }

  async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }
}
