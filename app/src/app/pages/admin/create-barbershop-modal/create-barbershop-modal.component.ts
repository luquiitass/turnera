import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NominatimService, AutocompleteResult } from '../../../core/nominatim.service';

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

  private addressSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private modalController: ModalController,
    private nominatimService: NominatimService,
  ) {
    this.setupAddressDebounce();
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    // Solo mostrar lista si hay resultados previos, no buscar automáticamente
    if (!newValue || newValue.trim().length < 3) {
      this.autocompleteResults = [];
      this.showAutocomplete = false;
      return;
    }
    // Enviar al subject para debounce
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
    console.log('🔍 Buscando:', query);

    this.nominatimService.autocomplete(query).subscribe({
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
      alert('Email, nombre y dirección son requeridos');
      return;
    }

    if (!this.selectedAddress) {
      alert('Por favor selecciona una dirección de las sugerencias');
      return;
    }

    const payload = {
      adminEmail,
      name,
      address: this.selectedAddress.address,
      phone: phone || undefined,
      latitude: this.selectedAddress.lat,
      longitude: this.selectedAddress.lng,
    };

    console.log('🚀 Creando barberia:', payload);
    this.modalController.dismiss(payload, 'create');
  }

  cancel(): void {
    this.modalController.dismiss(null, 'cancel');
  }
}
