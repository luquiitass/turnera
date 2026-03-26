import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Barber } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class BarbersService {
  private url = `${environment.apiUrl}/barbers`;

  constructor(private http: HttpClient) {}

  getByBarbershop(barbershopId: string): Observable<ApiResponse<Barber[]>> {
    return this.http.get<ApiResponse<Barber[]>>(`${this.url}/barbershop/${barbershopId}`);
  }

  getOne(id: string): Observable<ApiResponse<Barber>> {
    return this.http.get<ApiResponse<Barber>>(`${this.url}/${id}`);
  }

  create(data: any): Observable<ApiResponse<Barber>> {
    return this.http.post<ApiResponse<Barber>>(this.url, data);
  }

  update(id: string, data: any): Observable<ApiResponse<Barber>> {
    return this.http.put<ApiResponse<Barber>>(`${this.url}/${id}`, data);
  }

  assignServices(barberId: string, serviceIds: string[]): Observable<ApiResponse<Barber>> {
    return this.http.put<ApiResponse<Barber>>(`${this.url}/${barberId}/services`, { serviceIds });
  }

  // Barber own profile
  getMyProfile(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.url}/my-profile`);
  }

  updateMyProfile(data: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.url}/my-profile`, data);
  }

  addMyImage(imageUrl: string, caption?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.url}/my-profile/images`, { imageUrl, caption });
  }

  removeMyImage(imageId: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.url}/my-profile/images/${imageId}`);
  }

  // Barber reviews
  getBarberReviews(barberId: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.url}/${barberId}/reviews`);
  }

  getBarberReviewStats(barberId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.url}/${barberId}/reviews/stats`);
  }
}
