import { Component, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { StorageService } from '../../core/storage.service';
import { AlertController } from '@ionic/angular';
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
  isDevelopment = true;
  users: any[] = [];

  constructor(
    private authService: AuthService,
    private storage: StorageService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private ngZone: NgZone,
    private alertController: AlertController,
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
    this.loadDevUsers();
    this.initGoogleButton();
  }

  /**
   * Cargar usuarios registrados desde la API
   */
  private loadDevUsers(): void {
    this.http.get<any>(`${environment.apiUrl}/users/dev/list`).subscribe({
      next: (res) => {
        // Endpoint retorna array directo
        this.users = Array.isArray(res) ? res : res.data || [];
        console.log('📋 Usuarios disponibles:', this.users.length);
      },
      error: (err) => {
        console.error('Error cargando usuarios:', err);
        this.users = [];
      },
    });
  }

  /**
   * Seleccionar usuario en modo desarrollo
   */
  async selectDevUser(): Promise<void> {
    if (this.users.length === 0) {
      this.errorMessage = 'No hay usuarios disponibles';
      return;
    }

    const alert = await this.alertController.create({
      header: 'Seleccionar Usuario (Dev)',
      inputs: this.users.map((user: any) => ({
        name: 'user',
        type: 'radio',
        label: `${user.email}`,
        value: JSON.stringify(user),
      })),
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'OK',
          handler: (selectedUser: string) => {
            if (selectedUser) {
              const user = JSON.parse(selectedUser);
              this.loginWithDevUser(user);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Login con usuario de desarrollo (sin autenticación)
   */
  private loginWithDevUser(user: any): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Crear token ficticio para desarrollo
    const devToken = `dev-token-${user.id}-${Date.now()}`;

    // Guardar datos en storage
    this.storage.set('accessToken', devToken);
    this.storage.set('refreshToken', devToken);
    this.storage.setJson('currentUser', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Actualizar auth service
    (this.authService as any).currentUserSubject.next({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    console.log('🔓 Dev login:', user.email);

    setTimeout(() => {
      this.isLoading = false;
      this.redirectAfterLogin();
    }, 500);
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
        this.errorMessage = 'Error al iniciar sesion con Google';
        console.error('Google login error:', err);
      },
    });
  }

  redirectAfterLogin(): void {
    if (this.registrationCode) {
      this.router.navigate(['/tabs/home']);
      return;
    }

    if (this.redirectSlug) {
      this.router.navigate([`/barbershop/${this.redirectSlug}`]);
    } else {
      this.router.navigate(['/tabs/home']);
    }
  }

  goBack(): void {
    window.history.back();
  }
}
