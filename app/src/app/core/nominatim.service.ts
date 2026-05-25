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

@Injectable({ providedIn: 'root' })
export class NominatimService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  autocomplete(query: string): Observable<AutocompleteResult[]> {
    return this.http.get<AutocompleteResult[]>(`${this.api}/geocoding/autocomplete-raw`, {
      params: { query },
    });
  }

  reverseGeocode(lat: number, lng: number): Observable<any> {
    return this.http.post<any>(`${this.api}/geocoding/reverse`, { lat, lng });
  }
}
