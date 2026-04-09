import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LoadingController, ToastController } from '@ionic/angular';
import { Location } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-barbershop-profile',
  templateUrl: './barbershop-profile.page.html',
  styleUrls: ['./barbershop-profile.page.scss'],
  standalone: false,
})
export class BarbershopProfilePage implements OnInit {
  barbershop: any = null;
  services: any[] = [];
  barbers: any[] = [];
  amenities: any[] = [];
  reviews: any[] = [];
  offers: any[] = [];

  loading = true;
  error = false;
  navigator = navigator;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private location: Location,
    private loadingController: LoadingController,
    private toastController: ToastController,
  ) {}

  ngOnInit(): void {
    this.loadBarbershopProfile();
  }

  private async loadBarbershopProfile(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = true;
      this.loading = false;
      return;
    }

    try {
      const response = await this.http
        .get<any>(`${environment.apiUrl}/barbershops/${id}`)
        .toPromise();

      this.barbershop = response.data || response;
      this.services = this.barbershop.services || [];
      this.barbers = this.barbershop.barbers || [];
      this.amenities = this.barbershop.amenities || [];
      this.reviews = this.barbershop.reviews || [];
      this.offers = this.barbershop.offers || [];

      this.loading = false;
    } catch (err) {
      console.error('Error cargando barbería:', err);
      this.error = true;
      this.loading = false;
      this.showError('Error al cargar la información de la barbería');
    }
  }

  goToBooking(): void {
    if (!this.barbershop) return;
    this.router.navigate(['/booking'], {
      queryParams: { barbershopId: this.barbershop.id },
    });
  }

  shareBarber(): void {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: this.barbershop.name,
        text: `Descubre ${this.barbershop.name} en Turnera`,
        url,
      });
    }
  }

  private async showError(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'danger',
    });
    await toast.present();
  }

  goBack(): void {
    this.location.back();
  }
}
