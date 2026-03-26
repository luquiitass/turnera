import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private storage: StorageService, private router: Router) {
    this.loadStoredUser();
  }

  get currentUser(): any { return this.currentUserSubject.value; }
  get isAuthenticated(): boolean { return !!this.storage.get('accessToken'); }
  get accessToken(): string | null { return this.storage.get('accessToken'); }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap(res => this.handleAuth(res.data)));
  }

  googleLogin(idToken: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/google`, { idToken })
      .pipe(tap(res => this.handleAuth(res.data)));
  }

  register(data: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/register`, data)
      .pipe(tap(res => this.handleAuth(res.data)));
  }

  refresh(): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/refresh`, { refreshToken: this.storage.get('refreshToken') })
      .pipe(tap(res => {
        this.storage.set('accessToken', res.data.accessToken);
        this.storage.set('refreshToken', res.data.refreshToken);
      }));
  }

  logout(): void {
    this.storage.remove('accessToken');
    this.storage.remove('refreshToken');
    this.storage.remove('currentUser');
    this.currentUserSubject.next(null);
    // Redirect to base domain login with slug
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const baseDomains = environment.baseDomains;
    let slug = '';
    for (const base of baseDomains) {
      if (hostname.endsWith(base) && hostname !== base) {
        slug = hostname.replace(`.${base}`, '');
        break;
      }
    }
    if (slug) {
      const baseDomain = baseDomains[0];
      window.location.href = `${protocol}//${baseDomain}${port}/auth/login?redirect=${slug}`;
    } else {
      window.location.href = '/auth/login';
    }
  }

  private handleAuth(data: any): void {
    this.storage.set('accessToken', data.accessToken);
    this.storage.set('refreshToken', data.refreshToken);
    this.storage.setJson('currentUser', data.user);
    this.currentUserSubject.next(data.user);
  }

  private loadStoredUser(): void {
    const user = this.storage.getJson<any>('currentUser');
    if (user && this.storage.get('accessToken')) {
      this.currentUserSubject.next(user);
    } else if (this.storage.get('accessToken') && !user) {
      this.storage.remove('accessToken');
      this.storage.remove('refreshToken');
    }
  }
}
