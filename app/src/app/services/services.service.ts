import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Service } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private url = `${environment.apiUrl}/services`;

  constructor(private http: HttpClient) {}

  // Global catalog
  getAll(): Observable<ApiResponse<Service[]>> {
    return this.http.get<ApiResponse<Service[]>>(this.url);
  }

  getOne(id: string): Observable<ApiResponse<Service>> {
    return this.http.get<ApiResponse<Service>>(`${this.url}/${id}`);
  }

  create(data: any): Observable<ApiResponse<Service>> {
    return this.http.post<ApiResponse<Service>>(this.url, data);
  }

  update(id: string, data: any): Observable<ApiResponse<Service>> {
    return this.http.put<ApiResponse<Service>>(`${this.url}/${id}`, data);
  }

  // Barbershop-specific services
  getByBarbershop(barbershopId: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.url}/barbershop/${barbershopId}`);
  }

  addToBarbershop(data: { barbershopId: string; serviceId: string; price: number; durationMin: number }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.url}/barbershop`, data);
  }

  updateBarbershopService(id: string, data: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.url}/barbershop/${id}`, data);
  }
}
