import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AutocompleteResult {
  address: string;
  lat: number;
  lng: number;
  city?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NominatimService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Buscar direcciones via backend (sin envelope)
   */
  autocomplete(query: string): Observable<AutocompleteResult[]> {
    return this.http.get<AutocompleteResult[]>(
      `${this.api}/geocoding/autocomplete-raw`,
      {
        params: { query },
      }
    );
  }

  /**
   * Validar y geocodificar dirección
   */
  validate(address: string): Observable<AutocompleteResult> {
    return this.http.post<AutocompleteResult>(
      `${this.api}/geocoding/validate-address`,
      { address }
    );
  }
}
