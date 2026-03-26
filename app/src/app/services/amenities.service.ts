import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Amenity } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class AmenitiesService {
  private url = `${environment.apiUrl}/amenities`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResponse<Amenity[]>> {
    return this.http.get<ApiResponse<Amenity[]>>(this.url);
  }

  getByBarbershop(barbershopId: string): Observable<ApiResponse<Amenity[]>> {
    return this.http.get<ApiResponse<Amenity[]>>(`${this.url}/barbershop/${barbershopId}`);
  }

  create(data: { name: string; icon?: string; category?: string }): Observable<ApiResponse<Amenity>> {
    return this.http.post<ApiResponse<Amenity>>(this.url, data);
  }

  toggle(barbershopId: string, amenityId: string): Observable<ApiResponse<{ action: string }>> {
    return this.http.post<ApiResponse<{ action: string }>>(`${this.url}/toggle`, { barbershopId, amenityId });
  }
}
