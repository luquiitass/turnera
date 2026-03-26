import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private api = environment.apiUrl;
  private bsId = environment.barbershopId;

  constructor(private http: HttpClient) {}

  // Barbershop
  getBarbershop(): Observable<any> {
    return this.http.get<any>(`${this.api}/barbershops/${this.bsId}`);
  }

  // Services
  getServices(): Observable<any> {
    return this.http.get<any>(`${this.api}/services/barbershop/${this.bsId}`);
  }

  // Barbers
  getBarbers(): Observable<any> {
    return this.http.get<any>(`${this.api}/barbers/barbershop/${this.bsId}`);
  }

  getBarber(id: string): Observable<any> {
    return this.http.get<any>(`${this.api}/barbers/${id}`);
  }

  // Availability
  getAvailability(barberId: string, date: string, serviceId?: string): Observable<any> {
    let params = new HttpParams();
    if (serviceId) params = params.set('serviceId', serviceId);
    return this.http.get<any>(`${this.api}/schedules/availability/${barberId}/${date}`, { params });
  }

  // Bookings
  createBooking(data: any): Observable<any> {
    return this.http.post<any>(`${this.api}/bookings`, data);
  }

  getMyBookings(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    return this.http.get<any>(`${this.api}/bookings/my`, { params });
  }

  getBooking(id: string): Observable<any> {
    return this.http.get<any>(`${this.api}/bookings/${id}`);
  }

  cancelBooking(id: string): Observable<any> {
    return this.http.put<any>(`${this.api}/bookings/${id}/cancel`, {});
  }

  // Barber agenda
  getMyBarberProfile(): Observable<any> {
    return this.http.get<any>(`${this.api}/barbers/my-profile`);
  }

  getMyAgenda(date: string): Observable<any> {
    return this.http.get<any>(`${this.api}/barbers/my-agenda/${date}`);
  }

  createBlock(data: { barberId: string; date: string; startTime: string; endTime: string; reason?: string }): Observable<any> {
    return this.http.post<any>(`${this.api}/schedules/block`, data);
  }

  // Reviews
  getReviews(): Observable<any> {
    return this.http.get<any>(`${this.api}/reviews/barbershop/${this.bsId}`);
  }

  createReview(data: any): Observable<any> {
    return this.http.post<any>(`${this.api}/reviews`, { ...data, barbershopId: this.bsId });
  }

  // Amenities
  getAmenities(): Observable<any> {
    return this.http.get<any>(`${this.api}/amenities/barbershop/${this.bsId}`);
  }

  // User profile
  updateProfile(data: any): Observable<any> {
    return this.http.put<any>(`${this.api}/users/me`, data);
  }
}
