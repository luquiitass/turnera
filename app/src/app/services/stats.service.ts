import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private url = `${environment.apiUrl}/stats`;

  constructor(private http: HttpClient) {}

  getDashboard(barbershopId: string): Observable<any> {
    return this.http.get<any>(`${this.url}/barbershop/${barbershopId}/dashboard`);
  }

  getBookingsByBarber(barbershopId: string, from: string, to: string): Observable<any> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<any>(`${this.url}/barbershop/${barbershopId}/bookings-by-barber`, { params });
  }

  getOccupancyByHour(barbershopId: string): Observable<any> {
    return this.http.get<any>(`${this.url}/barbershop/${barbershopId}/occupancy-by-hour`);
  }
}
