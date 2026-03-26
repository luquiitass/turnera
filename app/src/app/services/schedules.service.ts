import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Schedule, TimeSlot } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class SchedulesService {
  private url = `${environment.apiUrl}/schedules`;

  constructor(private http: HttpClient) {}

  getByBarber(barberId: string): Observable<ApiResponse<Schedule[]>> {
    return this.http.get<ApiResponse<Schedule[]>>(`${this.url}/barber/${barberId}`);
  }

  getAvailability(barberId: string, date: string, serviceId?: string): Observable<ApiResponse<TimeSlot[]>> {
    let params = new HttpParams();
    if (serviceId) params = params.set('serviceId', serviceId);
    return this.http.get<ApiResponse<TimeSlot[]>>(`${this.url}/availability/${barberId}/${date}`, { params });
  }

  create(data: any): Observable<ApiResponse<Schedule[]>> {
    return this.http.post<ApiResponse<Schedule[]>>(this.url, data);
  }

  createBlock(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.url}/block`, data);
  }
}
