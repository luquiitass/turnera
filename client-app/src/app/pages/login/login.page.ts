import { Component, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { StorageService } from '../../core/storage.service';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  appName = 'Turnera';
  barbershopName = '';
  isLoading = false;
  errorMessage = '';
  redirectSlug = '';
  registrationCode = '';

  constructor(
    private authService: AuthService,
    private storage: StorageService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.redirectSlug = this.route.snapshot.queryParamMap.get('redirect') || '';
    this.registrationCode = this.route.snapshot.queryParamMap.get('code') || '';
    if (this.redirectSlug === 'create-barber') {
      this.appName = 'Turnera - Registrar Barberia';
    } else if (this.redirectSlug) {
      this.http.get<any>(`${environment.apiUrl}/barbershops/by-slug/${this.redirectSlug}`).subscribe({
        next: (res) => {
          this.barbershopName = res.data.name;
          this.appName = `Turnos ${res.data.name}`;
        },
      });
    }
    this.initGoogleButton();
  }

  initGoogleButton(): void {
    const interval = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(interval);
        google.accounts.id.initialize({
          client_id: '133837939687-0shh87htvb22621cajt7adh04ojsvg6t.apps.googleusercontent.com',
          callback: (response: any) => {
            this.ngZone.run(() => this.handleGoogleResponse(response));
          },
        });
        google.accounts.id.renderButton(
          document.getElementById('google-btn-container'),
          { theme: 'outline', size: 'large', width: 350, text: 'signin_with', shape: 'rectangular' },
        );
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 10000);
  }

  handleGoogleResponse(response: any): void {
    if (!response.credential) {
      this.errorMessage = 'No se recibio respuesta de Google.';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.googleLogin(response.credential).subscribe({
      next: () => {
        this.isLoading = false;
        this.redirectAfterLogin();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.error?.message ?? err?.error?.message ?? 'Error al iniciar sesion con Google.';
      },
    });
  }

  private redirectAfterLogin(): void {
    if (this.redirectSlug === 'create-barber' && this.registrationCode) {
      // Go to create barbershop page
      window.location.href = `/create-barber?code=${this.registrationCode}`;
    } else if (this.redirectSlug && this.redirectSlug !== 'create-barber') {
      // Redirect to subdomain
      const token = this.storage.get('accessToken') || '';
      const refreshToken = this.storage.get('refreshToken') || '';
      const user = this.storage.get('currentUser') || '';
      const port = window.location.port ? `:${window.location.port}` : '';
      const protocol = window.location.protocol;
      const baseDomain = environment.baseDomains[0];
      const params = new URLSearchParams({ t: token, r: refreshToken, u: user });
      window.location.href = `${protocol}//${this.redirectSlug}.${baseDomain}${port}/tabs/home#auth=${params.toString()}`;
    } else {
      window.location.href = '/barbershop-list';
    }
  }

  goBack(): void {
    if (this.redirectSlug) {
      const port = window.location.port ? `:${window.location.port}` : '';
      const protocol = window.location.protocol;
      const baseDomain = environment.baseDomains[0];
      window.location.href = `${protocol}//${this.redirectSlug}.${baseDomain}${port}`;
    } else {
      window.location.href = '/tabs/home';
    }
  }
}
