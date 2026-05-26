import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface BankAccount {
  id: string;
  barbershopId: string;
  accountType: 'CBU' | 'CVU' | 'MP_OAUTH';
  cbuCvu?: string;
  alias?: string;
  bankName?: string;
  holderName?: string;
  holderCuit?: string;
  accountCategory?: 'CAJA_AHORRO' | 'CUENTA_CORRIENTE';
  mpUserId?: string;
  isPrimary: boolean;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreateBankAccountDto {
  barbershopId: string;
  accountType: 'CBU' | 'CVU';
  cbuCvu: string;
  alias?: string;
  bankName?: string;
  holderName: string;
  holderCuit: string;
  accountCategory?: 'CAJA_AHORRO' | 'CUENTA_CORRIENTE';
  isPrimary?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class BankAccountsService {
  private readonly base = `${environment.apiUrl}/bank-accounts`;
  private readonly mpBase = `${environment.apiUrl}/mp`;

  constructor(private http: HttpClient) {}

  getByBarbershop(barbershopId: string): Observable<BankAccount[]> {
    return this.http.get<ApiResponse<BankAccount[]>>(`${this.base}/barbershop/${barbershopId}`)
      .pipe(map(r => r.data));
  }

  getPrimary(barbershopId: string): Observable<BankAccount | null> {
    return this.http.get<ApiResponse<BankAccount | null>>(`${this.base}/barbershop/${barbershopId}/primary`)
      .pipe(map(r => r.data));
  }

  create(dto: CreateBankAccountDto): Observable<BankAccount> {
    return this.http.post<ApiResponse<BankAccount>>(this.base, dto)
      .pipe(map(r => r.data));
  }

  update(id: string, dto: Partial<CreateBankAccountDto>): Observable<BankAccount> {
    return this.http.patch<ApiResponse<BankAccount>>(`${this.base}/${id}`, dto)
      .pipe(map(r => r.data));
  }

  setPrimary(id: string): Observable<BankAccount> {
    return this.http.patch<ApiResponse<BankAccount>>(`${this.base}/${id}/set-primary`, {})
      .pipe(map(r => r.data));
  }

  remove(id: string): Observable<BankAccount> {
    return this.http.delete<ApiResponse<BankAccount>>(`${this.base}/${id}`)
      .pipe(map(r => r.data));
  }

  // MercadoPago OAuth
  getMpOAuthUrl(barbershopId: string): Observable<{ url: string }> {
    return this.http.get<ApiResponse<{ url: string }>>(`${this.mpBase}/oauth/connect/${barbershopId}`)
      .pipe(map(r => r.data));
  }

  disconnectMpOAuth(barbershopId: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.mpBase}/oauth/disconnect/${barbershopId}`)
      .pipe(map(r => r.data));
  }
}
