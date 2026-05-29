import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ActiveContext {
  role: string;
  barbershopId: string;
  barbershopName: string;
}

const STORAGE_KEY = 'activeContext';

@Injectable({ providedIn: 'root' })
export class ActiveContextService {
  private ctx$ = new BehaviorSubject<ActiveContext | null>(this.load());

  context$    = this.ctx$.asObservable();
  get context()        { return this.ctx$.value; }
  get barbershopId()   { return this.ctx$.value?.barbershopId   ?? null; }
  get barbershopName() { return this.ctx$.value?.barbershopName ?? null; }

  set(role: string, barbershopId: string, barbershopName: string): void {
    const ctx: ActiveContext = { role, barbershopId, barbershopName };
    this.ctx$.next(ctx);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  }

  // Devuelve el contexto guardado para un rol específico (si coincide)
  getForRole(role: string): ActiveContext | null {
    const ctx = this.ctx$.value;
    return ctx?.role === role ? ctx : null;
  }

  clear(): void {
    this.ctx$.next(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private load(): ActiveContext | null {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); }
    catch { return null; }
  }
}
