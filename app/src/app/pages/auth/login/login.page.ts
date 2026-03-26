import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { StorageService } from '../../../core/services/storage.service';

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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private storage: StorageService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    const saved = this.storage.getJson<{ email: string; password: string }>('rememberLogin');
    this.loginForm = this.fb.group({
      email: [saved?.email || '', [Validators.required, Validators.email]],
      password: [saved?.password || '', [Validators.required, Validators.minLength(6)]],
    });
    this.rememberMe = !!saved;
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    const loading = await this.loadingCtrl.create({
      message: 'Iniciando sesion...',
    });
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
        await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
      },
      error: async (err) => {
        await loading.dismiss();
        const message =
          err?.error?.error?.message || err?.error?.message || 'Credenciales incorrectas. Intenta de nuevo.';
        this.errorMessage = message;
        const toast = await this.toastCtrl.create({
          message,
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
