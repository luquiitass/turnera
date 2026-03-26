import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { User, ApiResponse } from '../../shared/models';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private activeRoleSubject = new BehaviorSubject<string>('USUARIO');

  currentUser$ = this.currentUserSubject.asObservable();
  activeRole$ = this.activeRoleSubject.asObservable();

  constructor(
    private http: HttpClient,
    private storage: StorageService,
  ) {
    this.loadStoredUser();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get activeRole(): string {
    return this.activeRoleSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.storage.get('accessToken');
  }

  get accessToken(): string | null {
    return this.storage.get('accessToken');
  }

  login(email: string, password: string): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((res) => this.handleAuth(res.data)));
  }

  register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  }): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/register`, data)
      .pipe(tap((res) => this.handleAuth(res.data)));
  }

  refresh(): Observable<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    const refreshToken = this.storage.get('refreshToken');
    return this.http
      .post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
        `${environment.apiUrl}/auth/refresh`,
        { refreshToken },
      )
      .pipe(
        tap((res) => {
          this.storage.set('accessToken', res.data.accessToken);
          this.storage.set('refreshToken', res.data.refreshToken);
        }),
      );
  }

  logout(): void {
    this.storage.remove('accessToken');
    this.storage.remove('refreshToken');
    this.storage.remove('currentUser');
    this.storage.remove('activeRole');
    this.currentUserSubject.next(null);
    this.activeRoleSubject.next('USUARIO');
  }

  setActiveRole(role: string): void {
    this.activeRoleSubject.next(role);
    this.storage.set('activeRole', role);
  }

  getAvailableRoles(): string[] {
    return this.currentUser?.roles || ['USUARIO'];
  }

  hasRole(role: string): boolean {
    return this.currentUser?.roles?.includes(role) || false;
  }

  private handleAuth(data: AuthResponse): void {
    this.storage.set('accessToken', data.accessToken);
    this.storage.set('refreshToken', data.refreshToken);
    this.storage.setJson('currentUser', data.user);
    this.currentUserSubject.next(data.user);

    const storedRole = this.storage.get('activeRole');
    if (storedRole && data.user.roles.includes(storedRole)) {
      this.activeRoleSubject.next(storedRole);
    } else {
      this.setActiveRole(data.user.roles[0]);
    }
  }

  private loadStoredUser(): void {
    const token = this.storage.get('accessToken');
    const user = this.storage.getJson<User>('currentUser');
    if (user && token) {
      this.currentUserSubject.next(user);
      const role = this.storage.get('activeRole') || user.roles[0];
      this.activeRoleSubject.next(role);
      // Validate token is still valid
      this.http.get<any>(`${environment.apiUrl}/auth/profile`).subscribe({
        next: (res) => {
          // Update user data from server
          this.storage.setJson('currentUser', res.data);
          this.currentUserSubject.next(res.data);
        },
        error: () => {
          // Token expired or invalid - clean up
          this.logout();
        },
      });
    } else if (token && !user) {
      // Corrupted state
      this.logout();
    }
  }
}
