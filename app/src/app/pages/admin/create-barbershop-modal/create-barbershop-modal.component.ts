import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, LoadingController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NominatimService, AutocompleteResult } from '../../../core/nominatim.service';
import { GeolocationService, Location } from '../../../core/geolocation.service';
import { BarbershopsService } from '../../../services/barbershops.service';

@Component({
  selector: 'app-create-barbershop-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './create-barbershop-modal.component.html',
  styleUrls: ['./create-barbershop-modal.component.scss'],
})
export class CreateBarbershopModalComponent implements OnInit, OnDestroy {
  form = {
    adminEmail: '',
    name: '',
    address: '',
    phone: '',
  };

  autocompleteResults: AutocompleteResult[] = [];
  showAutocomplete = false;
  selectedAddress: AutocompleteResult | null = null;
  isSearching = false;
  isSubmitting = false;

  private addressSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private userLocation: Location | null = null;
  private locationInfo = { city: '', state: '', country: '' };

  constructor(
    private modalController: ModalController,
    private nominatimService: NominatimService,
    private geolocationService: GeolocationService,
    private barbershopsService: BarbershopsService,
    private loadingController: LoadingController,
    private toastController: ToastController,
  ) {
    this.setupAddressDebounce();
  }

  ngOnInit(): void {
    this.initializeLocation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeLocation(): Promise<void> {
    try {
      const location = await this.geolocationService.getCurrentLocation();
      if (location) {
        this.userLocation = location;
        console.log('📍 Ubicación obtenida:', location);
        this.getLocationInfo(location);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo obtener ubicación:', error);
    }
  }

  private getLocationInfo(location: Location): void {
    this.nominatimService.reverseGeocode(location.latitude, location.longitude).subscribe({
      next: (result: any) => {
        const addr = result.data?.address || result.address || {};
        this.locationInfo = {
          city: addr.city || addr.town || '',
          state: addr.state || '',
          country: addr.country || '',
        };
        console.log('🏘️ Localidad, Provincia, País:', this.locationInfo);
      },
      error: (err: any) => {
        console.warn('⚠️ Error en reverse geocode:', err);
      },
    });
  }

  private setupAddressDebounce(): void {
    this.addressSubject
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
      )
      .subscribe((query: string) => {
        if (!query || query.trim().length < 3) {
          this.autocompleteResults = [];
          this.showAutocomplete = false;
          return;
        }
        this.performSearch(query);
      });
  }

  onAddressChange(newValue: string): void {
    console.log('📝 Escribiendo:', newValue);
    if (!newValue || newValue.trim().length < 3) {
      this.autocompleteResults = [];
      this.showAutocomplete = false;
      return;
    }
    this.addressSubject.next(newValue.trim());
  }

  searchAddress(): void {
    const query = this.form.address.trim();
    if (query && query.length >= 3) {
      this.performSearch(query);
    }
  }

  private performSearch(query: string): void {
    this.isSearching = true;

    // Enriquecer búsqueda con localidad si no la contiene
    let enrichedQuery = query;
    const queryLower = query.toLowerCase();

    if (
      this.locationInfo.city &&
      !queryLower.includes(this.locationInfo.city.toLowerCase())
    ) {
      enrichedQuery = `${query}, ${this.locationInfo.city}`;
    }

    console.log('🔍 Buscando:', enrichedQuery);

    this.nominatimService.autocomplete(enrichedQuery).subscribe({
      next: (results: AutocompleteResult[]) => {
        console.log('✅ Resultados:', results.length);

        this.autocompleteResults = results;
        this.showAutocomplete = results.length > 0;
        this.isSearching = false;
      },
      error: (err: any) => {
        console.error('❌ Error:', err);
        this.autocompleteResults = [];
        this.showAutocomplete = false;
        this.isSearching = false;
      },
    });
  }

  selectAddress(result: AutocompleteResult): void {
    console.log('✅ Seleccionado:', result.address);

    this.selectedAddress = result;
    this.form.address = result.address;
    this.autocompleteResults = [];
    this.showAutocomplete = false;
  }

  async createBarbershop(): Promise<void> {
    const { adminEmail, name, address, phone } = this.form;

    if (!adminEmail || !name || !address) {
      await this.showError('Email, nombre y dirección son requeridos');
      return;
    }

    if (!this.selectedAddress) {
      await this.showError('Por favor selecciona una dirección de las sugerencias');
      return;
    }

    this.isSubmitting = true;
    const loader = await this.loadingController.create({
      message: 'Creando barberia...',
    });
    await loader.present();

    const payload = {
      adminEmail,
      name,
      address: this.selectedAddress.address,
      phone: phone || undefined,
      latitude: this.selectedAddress.lat,
      longitude: this.selectedAddress.lng,
    };

    console.log('🚀 Creando barberia:', payload);

    this.barbershopsService.create(payload as any).subscribe({
      next: async () => {
        await loader.dismiss();
        this.isSubmitting = false;
        await this.showSuccess('Barberia creada con éxito');
        // Solo cerrar el modal si fue exitoso
        this.modalController.dismiss(null, 'success');
      },
      error: async (err: any) => {
        await loader.dismiss();
        this.isSubmitting = false;
        const msg = err?.error?.error?.message || 'Error al crear barberia';
        await this.showError(msg);
        // NO cerrar el modal, mantiene el formulario abierto para reintentar
      },
    });
  }

  cancel(): void {
    this.modalController.dismiss(null, 'cancel');
  }

  private async showSuccess(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }

  private async showError(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }
}
