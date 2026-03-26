import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PaginatedData, Booking } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private url = `${environment.apiUrl}/bookings`;

  constructor(private http: HttpClient) {}

  create(data: { barberId: string; serviceId: string; date: string; startTime: string; notes?: string }): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>(this.url, data);
  }

  getMyBookings(filters?: { status?: string; from?: string; to?: string; page?: number }): Observable<ApiResponse<PaginatedData<Booking>>> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page.toString());
    return this.http.get<ApiResponse<PaginatedData<Booking>>>(`${this.url}/my`, { params });
  }

  getOne(id: string): Observable<ApiResponse<Booking>> {
    return this.http.get<ApiResponse<Booking>>(`${this.url}/${id}`);
  }

  cancel(id: string): Observable<ApiResponse<Booking>> {
    return this.http.put<ApiResponse<Booking>>(`${this.url}/${id}/cancel`, {});
  }

  getByBarbershop(barbershopId: string, filters?: any): Observable<ApiResponse<PaginatedData<Booking>>> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    return this.http.get<ApiResponse<PaginatedData<Booking>>>(`${this.url}/barbershop/${barbershopId}`, { params });
  }
}
