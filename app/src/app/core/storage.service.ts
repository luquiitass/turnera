import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get(key: string): string | null { return localStorage.getItem(key); }
  set(key: string, value: string): void { localStorage.setItem(key, value); }
  remove(key: string): void { localStorage.removeItem(key); }
  getJson<T>(key: string): T | null {
    const v = this.get(key);
    if (!v) return null;
    try { return JSON.parse(v); } catch { return null; }
  }
  setJson(key: string, value: any): void { this.set(key, JSON.stringify(value)); }
}
