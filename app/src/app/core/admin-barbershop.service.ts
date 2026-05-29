import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminBarbershop {
  id: string;
  name: string;
  address?: string;
  slug?: string;
  adminRole?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminBarbershopService {
  private barbershopsSubject = new BehaviorSubject<AdminBarbershop[]>([]);
  private selectedSubject   = new BehaviorSubject<AdminBarbershop | null>(null);

  barbershops$ = this.barbershopsSubject.asObservable();
  selected$    = this.selectedSubject.asObservable();

  constructor(private http: HttpClient) {}

  get barbershops(): AdminBarbershop[]    { return this.barbershopsSubject.value; }
  get selected(): AdminBarbershop | null  { return this.selectedSubject.value; }
  get selectedId(): string | null         { return this.selected?.id ?? null; }

  load(): void {
    this.http.get<any>(`${environment.apiUrl}/users/me/barbershops`).subscribe({
      next: (res) => {
        const data  = res?.data ?? res;
        const list: AdminBarbershop[] = data.adminBarbershops ?? [];
        this.barbershopsSubject.next(list);
        // Mantener selección si sigue existiendo, sino seleccionar la primera
        const current = this.selected;
        const still   = current ? list.find(b => b.id === current.id) : null;
        this.selectedSubject.next(still ?? list[0] ?? null);
      },
      error: () => {},
    });
  }

  select(barbershop: AdminBarbershop): void {
    this.selectedSubject.next(barbershop);
  }

  selectById(id: string): void {
    const bs = this.barbershops.find(b => b.id === id);
    if (bs) this.selectedSubject.next(bs);
  }
}
