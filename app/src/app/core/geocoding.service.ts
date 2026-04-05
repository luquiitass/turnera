import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  country?: string;
}

export interface AutocompleteResult {
  address: string;
  lat: number;
  lng: number;
  city?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeocodingService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Validar y geocodificar una dirección
   */
  validateAddress(address: string): Observable<GeocodeResult> {
    return this.http.post<GeocodeResult>(`${this.api}/geocoding/validate-address`, { address });
  }

  /**
   * Autocompletado de direcciones
   */
  autocompleteAddress(query: string): Observable<AutocompleteResult[]> {
    return this.http.get<AutocompleteResult[]>(`${this.api}/geocoding/autocomplete`, {
      params: { query },
    });
  }
}
