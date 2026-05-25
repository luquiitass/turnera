import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface NearbyBarbershop {
  id: string;
  name: string;
  address: string;
  logoImage?: string;
  distance: number;
  avgRating: number;
  totalReviews: number;
  latitude?: number;
  longitude?: number;
}

@Injectable({
  providedIn: 'root',
})
export class NearbyBarbershopsService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Buscar barberias cercanas (por backend)
   */
  findNearby(lat: number, lng: number, radiusKm: number = 5): Observable<NearbyBarbershop[]> {
    let params = new HttpParams();
    params = params.set('latitude', lat.toString());
    params = params.set('longitude', lng.toString());
    params = params.set('radiusKm', radiusKm.toString());

    return this.http.get<any>(`${this.api}/barbershops/nearby`, { params }).pipe(
      map(response => Array.isArray(response) ? response : (response.data || []))
    );
  }

  /**
   * Buscar por ciudad
   */
  searchByCity(city: string): Observable<NearbyBarbershop[]> {
    return this.http.get<any>(`${this.api}/barbershops/search-by-city/${city}`).pipe(
      map(response => Array.isArray(response) ? response : (response.data || []))
    );
  }

  /**
   * Búsqueda general
   */
  search(query: string): Observable<NearbyBarbershop[]> {
    let params = new HttpParams();
    params = params.set('q', query);
    return this.http.get<any>(`${this.api}/barbershops/search`, { params }).pipe(
      map(response => Array.isArray(response) ? response : (response.data || []))
    );
  }
}
