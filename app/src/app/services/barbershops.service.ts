import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PaginatedData, Barbershop } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class BarbershopsService {
  private url = `${environment.apiUrl}/barbershops`;

  constructor(private http: HttpClient) {}

  getAllAdmin(): Observable<ApiResponse<Barbershop[]>> {
    return this.http.get<ApiResponse<Barbershop[]>>(`${this.url}/admin/all`);
  }

  deactivate(id: string): Observable<ApiResponse<Barbershop>> {
    return this.http.delete<ApiResponse<Barbershop>>(`${this.url}/${id}`);
  }

  activate(id: string): Observable<ApiResponse<Barbershop>> {
    return this.http.put<ApiResponse<Barbershop>>(`${this.url}/${id}/activate`, {});
  }

  getAll(params?: { search?: string; page?: number; limit?: number }): Observable<ApiResponse<PaginatedData<Barbershop>>> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<ApiResponse<PaginatedData<Barbershop>>>(this.url, { params: httpParams });
  }

  getOne(id: string): Observable<ApiResponse<Barbershop>> {
    return this.http.get<ApiResponse<Barbershop>>(`${this.url}/${id}`);
  }

  getMyBarbershops(): Observable<ApiResponse<Barbershop[]>> {
    return this.http.get<ApiResponse<Barbershop[]>>(`${this.url}/admin/my-barbershops`);
  }

  create(data: Partial<Barbershop>): Observable<ApiResponse<Barbershop>> {
    return this.http.post<ApiResponse<Barbershop>>(this.url, data);
  }

  update(id: string, data: Partial<Barbershop>): Observable<ApiResponse<Barbershop>> {
    return this.http.put<ApiResponse<Barbershop>>(`${this.url}/${id}`, data);
  }

  updateSlug(id: string, slug: string | null): Observable<ApiResponse<Barbershop>> {
    return this.http.patch<ApiResponse<Barbershop>>(`${this.url}/${id}/slug`, { slug });
  }

  addImage(barbershopId: string, imageId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.url}/${barbershopId}/images`, { imageId });
  }

  removeImage(barbershopId: string, imageId: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.url}/${barbershopId}/images/${imageId}`);
  }
}
