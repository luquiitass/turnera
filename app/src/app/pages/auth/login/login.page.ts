import { Component, OnInit, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { StorageService } from '../../../core/services/storage.service';
import { environment } from '../../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  rememberMe = false;
  errorMessage = '';
  googleLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private storage: StorageService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    // Si ya está autenticado y viene de un slug, pasarle los tokens y redirigir
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('redirect');
    if (slug && this.authService.isAuthenticated) {
      this.redirectToSubdomain(slug);
      return;
    }

    const saved = this.storage.getJson<{ email: string; password: string }>('rememberLogin');
    this.loginForm = this.fb.group({
      email:    [saved?.email    || '', [Validators.required, Validators.email]],
      password: [saved?.password || '', [Validators.required, Validators.minLength(6)]],
    });
    this.rememberMe = !!saved;
    this.initGoogleButton();
  }

  get email()    { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

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
          { theme: 'outline', size: 'large', width: 320, text: 'signin_with', shape: 'rectangular' },
        );
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 10000);
  }

  handleGoogleResponse(response: any): void {
    if (!response.credential) {
      this.errorMessage = 'No se recibió respuesta de Google.';
      return;
    }
    this.googleLoading = true;
    this.errorMessage = '';
    this.authService.googleLogin(response.credential).subscribe({
      next: () => {
        this.googleLoading = false;
        this.navigateAfterLogin();
      },
      error: (err) => {
        this.googleLoading = false;
        this.errorMessage = err?.error?.error?.message || 'Error al iniciar sesión con Google.';
      },
    });
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    const loading = await this.loadingCtrl.create({ message: 'Iniciando sesión...' });
    await loading.present();

    const { email, password } = this.loginForm.value;

    if (this.rememberMe) {
      this.storage.setJson('rememberLogin', { email, password });
    } else {
      this.storage.remove('rememberLogin');
    }

    this.authService.login(email, password).subscribe({
      next: async () => {
        await loading.dismiss();
        this.navigateAfterLogin();
      },
      error: async (err) => {
        await loading.dismiss();
        const message = err?.error?.error?.message || err?.error?.message || 'Credenciales incorrectas.';
        this.errorMessage = message;
        const toast = await this.toastCtrl.create({ message, duration: 3000, color: 'danger', position: 'top' });
        await toast.present();
      },
    });
  }

  private navigateAfterLogin(): void {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('redirect');
    const defaultRoute = this.authService.getDefaultRoute();
    const isAdmin = defaultRoute !== '/tabs/home';

    if (slug && !isAdmin) {
      this.redirectToSubdomain(slug);
      return;
    }

    this.router.navigateByUrl(defaultRoute, { replaceUrl: true });
  }

  // Redirige al subdominio del slug pasando los tokens en el hash
  // El resolver los consume via consumeAuthHash() al cargar
  private redirectToSubdomain(slug: string): void {
    const token   = this.storage.get('accessToken') || '';
    const refresh = this.storage.get('refreshToken') || '';
    const user    = JSON.stringify(this.storage.getJson('currentUser') || {});
    const hash    = `#auth=t=${encodeURIComponent(token)}&r=${encodeURIComponent(refresh)}&u=${encodeURIComponent(user)}`;
    const port     = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const base     = environment.baseDomains[0];
    window.location.href = `${protocol}//${slug}.${base}${port}/tabs/home${hash}`;
  }
}
