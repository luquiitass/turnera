import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController, RefresherCustomEvent } from '@ionic/angular';
import { GeolocationService, Location } from '../../core/geolocation.service';
import { NearbyBarbershopsService } from '../../core/nearby-barbershops.service';

interface Barbershop {
  id: string;
  name: string;
  address: string;
  logoImage?: string;
  distance?: number;
  avgRating: number;
  totalReviews: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  selector: 'app-nearby-barbershops',
  templateUrl: './nearby-barbershops.page.html',
  styleUrls: ['./nearby-barbershops.page.scss'],
})
export class NearbyBarbershopsPage implements OnInit {
  barbershops: Barbershop[] = [];
  loading = false;
  hasLocation = false;
  searchQuery = '';
  radiusKm = 5;
  minRadius = 1;
  maxRadius = 50;
  searchCity = '';
  activeTab: 'nearby' | 'search' = 'nearby';

  constructor(
    private geolocationService: GeolocationService,
    private nearbyService: NearbyBarbershopsService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadNearbyBarbershops();
  }

  async loadNearbyBarbershops(): Promise<void> {
    const location = this.geolocationService.getStoredLocation();

    if (!location) {
      this.hasLocation = false;
      return;
    }

    this.hasLocation = true;
    await this.searchNearby(location);
  }

  async searchNearby(location: Location): Promise<void> {
    const loader = await this.loadingController.create({ message: 'Buscando barberias...' });
    await loader.present();

    this.nearbyService.findNearby(location.latitude, location.longitude, this.radiusKm).subscribe({
      next: (data) => {
        this.barbershops = data;
        loader.dismiss();
      },
      error: (err) => {
        console.error('Error al buscar barberias cercanas:', err);
        loader.dismiss();
        this.showError('Error al buscar barberias cercanas');
      },
    });
  }

  async onRadiusChange(): Promise<void> {
    const location = this.geolocationService.getStoredLocation();
    if (location) {
      await this.searchNearby(location);
    }
  }

  async searchByCity(): Promise<void> {
    if (!this.searchCity.trim()) {
      this.showError('Ingresa una ciudad');
      return;
    }

    const loader = await this.loadingController.create({ message: 'Buscando...' });
    await loader.present();

    this.nearbyService.searchByCity(this.searchCity).subscribe({
      next: (data) => {
        this.barbershops = data;
        loader.dismiss();
      },
      error: (err) => {
        console.error('Error:', err);
        loader.dismiss();
        this.showError('Error al buscar');
      },
    });
  }

  async searchByName(): Promise<void> {
    if (!this.searchQuery.trim()) {
      this.showError('Ingresa un nombre');
      return;
    }

    const loader = await this.loadingController.create({ message: 'Buscando...' });
    await loader.present();

    this.nearbyService.search(this.searchQuery).subscribe({
      next: (data) => {
        this.barbershops = data;
        loader.dismiss();
      },
      error: (err) => {
        console.error('Error:', err);
        loader.dismiss();
        this.showError('Error al buscar');
      },
    });
  }

  goToBarbershop(barbershopId: string, slug?: string): void {
    if (slug) {
      window.location.href = `${slug}.${window.location.hostname}:${window.location.port}`;
    } else {
      this.router.navigate(['/tabs/home'], { queryParams: { barbershop: barbershopId } });
    }
  }

  async requestLocation(): Promise<void> {
    const loader = await this.loadingController.create({ message: 'Obteniendo ubicación...' });
    await loader.present();

    const location = await this.geolocationService.getCurrentLocation(true);
    loader.dismiss();

    if (location) {
      this.hasLocation = true;
      await this.searchNearby(location);
    } else {
      this.showError('No se pudo obtener tu ubicación');
    }
  }

  async doRefresh(event: any): Promise<void> {
    if (this.activeTab === 'nearby' && this.hasLocation) {
      const location = this.geolocationService.getStoredLocation();
      if (location) {
        await this.searchNearby(location);
      }
    }
    setTimeout(() => {
      event.target.complete();
    }, 500);
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
