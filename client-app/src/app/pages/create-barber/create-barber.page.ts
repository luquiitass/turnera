import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { StorageService } from '../../core/storage.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-create-barber',
  templateUrl: './create-barber.page.html',
  styleUrls: ['./create-barber.page.scss'],
  standalone: false,
})
export class CreateBarberPage implements OnInit {
  form!: FormGroup;
  code = '';
  codeValid = false;
  codeError = '';
  isLoading = false;
  isSubmitting = false;
  submitError = '';
  userEmail = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthService,
    private storage: StorageService,
  ) {}

  ngOnInit(): void {
    this.code = this.route.snapshot.queryParamMap.get('code') || '';
    this.userEmail = this.auth.currentUser?.email || '';

    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: ['', Validators.required],
      phone: [''],
      description: [''],
    });

    if (this.code) {
      this.validateCode();
    }
  }

  validateCode(): void {
    this.isLoading = true;
    this.codeError = '';
    this.http.get<any>(`${environment.apiUrl}/registration/validate/${this.code}`).subscribe({
      next: () => {
        this.codeValid = true;
        this.isLoading = false;
      },
      error: (err) => {
        this.codeError = err?.error?.error?.message ?? err?.error?.message ?? 'Codigo invalido';
        this.codeValid = false;
        this.isLoading = false;
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid || !this.codeValid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const payload = {
      code: this.code,
      ...this.form.value,
    };

    this.http.post<any>(`${environment.apiUrl}/registration/register-barbershop`, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        const slug = res.data.slug;
        // Redirect to the new barbershop subdomain
        const token = this.storage.get('accessToken') || '';
        const refreshToken = this.storage.get('refreshToken') || '';
        const user = this.storage.get('currentUser') || '';
        const port = window.location.port ? `:${window.location.port}` : '';
        const protocol = window.location.protocol;
        const baseDomain = environment.baseDomains[0];
        const params = new URLSearchParams({ t: token, r: refreshToken, u: user });
        window.location.href = `${protocol}//${slug}.${baseDomain}${port}/tabs/home#auth=${params.toString()}`;
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = err?.error?.error?.message ?? err?.error?.message ?? 'Error al registrar la barberia';
      },
    });
  }
}
