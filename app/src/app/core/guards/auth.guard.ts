import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.isAuthenticated) {
      return true;
    }
    this.router.navigate(['/auth/login']);
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class GuestGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private storage: StorageService,
  ) {}

  canActivate(): boolean {
    if (!this.authService.isAuthenticated) {
      return true;
    }

    // Usuario ya autenticado + viene de un slug → pasarle los tokens y redirigir al subdominio
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('redirect');
    if (slug) {
      const token   = this.storage.get('accessToken') || '';
      const refresh = this.storage.get('refreshToken') || '';
      const user    = JSON.stringify(this.storage.getJson('currentUser') || {});
      const hash    = `#auth=t=${encodeURIComponent(token)}&r=${encodeURIComponent(refresh)}&u=${encodeURIComponent(user)}`;
      const port     = window.location.port ? `:${window.location.port}` : '';
      const base     = environment.baseDomains[0];
      window.location.href = `${window.location.protocol}//${slug}.${base}${port}/tabs/home${hash}`;
      return false;
    }

    const role = this.authService.activeRole;
    const isAdmin = ['ADMIN_GENERAL', 'ADMIN_BARBERSHOP', 'SUB_ADMIN'].includes(role);
    this.router.navigate([isAdmin ? '/admin/tabs/home' : '/tabs/home']);
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const role = this.authService.activeRole;
    if (['ADMIN_GENERAL', 'ADMIN_BARBERSHOP', 'SUB_ADMIN'].includes(role)) {
      return true;
    }
    this.router.navigate(['/admin/tabs/home']);
    return false;
  }
}
