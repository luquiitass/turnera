import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BarbershopsService } from '../../../services/barbershops.service';
import { GeolocationService } from '../../../core/geolocation.service';
import { Barbershop } from '../../../shared/models';

@Component({
  standalone: false,
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
})
export class SearchPage implements OnInit {
  barbershops: Barbershop[] = [];
  searchQuery = '';
  isLoading = false;
  hasSearched = false;

  private userLat: number | null = null;
  private userLng: number | null = null;
  private searchSubject = new Subject<string>();

  constructor(
    private barbershopsService: BarbershopsService,
    private geolocationService: GeolocationService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    const loc = await this.geolocationService.getCurrentLocation();
    if (loc) {
      this.userLat = loc.latitude;
      this.userLng = loc.longitude;
    }

    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(query => this.fetchBarbershops(query));

    this.fetchBarbershops('');
  }

  onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value ?? '').trim();
    this.searchQuery = value;
    this.searchSubject.next(value);
  }

  onSearchClear(): void {
    this.searchQuery = '';
    this.searchSubject.next('');
  }

  fetchBarbershops(search: string): void {
    this.isLoading = true;
    this.hasSearched = true;
    this.barbershopsService.getAll({ search: search || undefined, limit: 20 }).subscribe({
      next: res => {
        this.barbershops = res.data.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  goToDetail(barbershop: Barbershop): void {
    this.router.navigate(['/admin/barbershop', barbershop.id]);
  }

  getAmenitiesCount(barbershop: Barbershop): number {
    return barbershop.amenities?.length ?? 0;
  }

  getRatingStars(rating: number): string {
    const rounded = Math.round(rating * 10) / 10;
    return rounded.toFixed(1);
  }

  getDistance(barbershop: Barbershop): string | null {
    if (
      this.userLat === null ||
      this.userLng === null ||
      barbershop.latitude == null ||
      barbershop.longitude == null
    ) return null;

    const R = 6371;
    const dLat = this.toRad(barbershop.latitude - this.userLat);
    const dLng = this.toRad(barbershop.longitude - this.userLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(this.userLat)) *
        Math.cos(this.toRad(barbershop.latitude)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
