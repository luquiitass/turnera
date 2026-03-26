import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BarbershopsService } from '../../../services/barbershops.service';
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

  private searchSubject = new Subject<string>();

  constructor(
    private barbershopsService: BarbershopsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
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
    this.router.navigate(['/barbershop', barbershop.id]);
  }

  getAmenitiesCount(barbershop: Barbershop): number {
    return barbershop.amenities?.length ?? 0;
  }

  getRatingStars(rating: number): string {
    const rounded = Math.round(rating * 10) / 10;
    return rounded.toFixed(1);
  }
}
