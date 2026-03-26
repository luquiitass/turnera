import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage implements OnInit {
  registerForm!: FormGroup;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.pattern(/^\+?[0-9]{7,15}$/)]],
    });
  }

  get firstName() {
    return this.registerForm.get('firstName');
  }

  get lastName() {
    return this.registerForm.get('lastName');
  }

  get email() {
    return this.registerForm.get('email');
  }

  get password() {
    return this.registerForm.get('password');
  }

  get phone() {
    return this.registerForm.get('phone');
  }

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    const loading = await this.loadingCtrl.create({
      message: 'Creando cuenta...',
    });
    await loading.present();

    const { firstName, lastName, email, password, phone } =
      this.registerForm.value;

    this.authService
      .register({ firstName, lastName, email, password, phone: phone || undefined })
      .subscribe({
        next: async () => {
          await loading.dismiss();
          const toast = await this.toastCtrl.create({
            message: 'Cuenta creada exitosamente. Bienvenido.',
            duration: 2000,
            color: 'success',
            position: 'top',
          });
          await toast.present();
          await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
        },
        error: async (err) => {
          await loading.dismiss();
          const message =
            err?.error?.error?.message || err?.error?.message || 'No se pudo crear la cuenta. Intenta de nuevo.';
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
