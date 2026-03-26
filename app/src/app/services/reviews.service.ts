import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Review } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private url = `${environment.apiUrl}/reviews`;

  constructor(private http: HttpClient) {}

  getByBarbershop(barbershopId: string): Observable<ApiResponse<Review[]>> {
    return this.http.get<ApiResponse<Review[]>>(`${this.url}/barbershop/${barbershopId}`);
  }

  getStats(barbershopId: string): Observable<ApiResponse<{ average: number; total: number; distribution: Record<string, number> }>> {
    return this.http.get<ApiResponse<any>>(`${this.url}/barbershop/${barbershopId}/stats`);
  }

  create(data: { barbershopId: string; rating: number; comment?: string }): Observable<ApiResponse<Review>> {
    return this.http.post<ApiResponse<Review>>(this.url, data);
  }

  update(id: string, data: { rating?: number; comment?: string }): Observable<ApiResponse<Review>> {
    return this.http.put<ApiResponse<Review>>(`${this.url}/${id}`, data);
  }

  remove(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.url}/${id}`);
  }
}
