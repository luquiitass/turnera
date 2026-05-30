import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { StorageService } from '../../../core/services/storage.service';
import { environment } from '../../../../environments/environment';

interface Plan {
  id: string;
  name: string;
  price: string;
  desc: string;
  features: string[];
  highlight: boolean;
}

@Component({
  selector: 'app-register-barbershop',
  templateUrl: './register-barbershop.page.html',
  styleUrls: ['./register-barbershop.page.scss'],
  standalone: false,
})
export class RegisterBarbershopPage {
  form!: FormGroup;
  submitting = false;
  success = false;
  newSlug = '';

  // Slug
  slugChecking = false;
  slugAvailable: boolean | null = null;
  slugError = '';
  private slugTimer: ReturnType<typeof setTimeout> | null = null;

  readonly baseDomain = environment.baseDomains?.[0] ?? 'turnera.es';

  // Autocomplete de dirección
  addressSuggestions: { address: string; lat: number; lng: number }[] = [];
  addressSearching = false;
  selectedLat: number | null = null;
  selectedLng: number | null = null;
  mapUrl: SafeResourceUrl | null = null;
  private addressTimer: ReturnType<typeof setTimeout> | null = null;

  readonly plans: Plan[] = [
    {
      id: 'GRATUITO',
      name: 'Gratuito',
      price: '$0',
      desc: 'Para empezar sin compromiso',
      features: [
        'Perfil de barbería online',
        'Hasta 2 barberos',
        'Reservas online 24/7',
        'Notificaciones in-app',
      ],
      highlight: false,
    },
    {
      id: 'SUSCRIPCION',
      name: 'Suscripción',
      price: '$10.000/mes',
      desc: 'Todo incluido, sin sorpresas',
      features: [
        'Todo del plan Gratuito',
        'Barberos ilimitados',
        'WhatsApp automático',
        'Estadísticas completas',
        'Pagos con MercadoPago',
      ],
      highlight: true,
    },
    {
      id: 'COMISION',
      name: 'Comisión',
      price: '10% por reserva',
      desc: 'Sin costo fijo mensual',
      features: [
        'Todo del plan Suscripción',
        'Pagás solo cuando cobrás',
        'Seña del 30% al reservar',
        'Gestión de pagos automática',
      ],
      highlight: false,
    },
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private auth: AuthService,
    private storage: StorageService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private sanitizer: DomSanitizer,
  ) {
    this.form = this.fb.group({
      name:        ['', [Validators.required, Validators.minLength(3)]],
      slug:        ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/)]],
      address:     ['', Validators.required],
      lat:         [null],
      lng:         [null],
      phone:       [''],
      description: [''],
      plan:        ['GRATUITO', Validators.required],
    });
  }

  // ── Slug ──────────────────────────────────────────────────────────────────
  onNameInput(): void {
    const name: string = this.form.value.name ?? '';
    const suggested = name.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (suggested.length >= 3) {
      this.form.patchValue({ slug: suggested });
      this.checkSlug(suggested);
    }
  }

  onSlugInput(): void {
    const slug = this.form.value.slug ?? '';
    const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (normalized !== slug) this.form.patchValue({ slug: normalized });
    this.checkSlug(normalized);
  }

  private checkSlug(slug: string): void {
    this.slugAvailable = null;
    this.slugError = '';
    if (!slug || slug.length < 3) return;

    if (this.slugTimer) clearTimeout(this.slugTimer);
    this.slugTimer = setTimeout(() => {
      this.slugChecking = true;
      this.http.get<any>(`${environment.apiUrl}/barbershops/check-slug/${slug}`).subscribe({
        next: (res) => {
          const data = res.data ?? res;
          this.slugChecking = false;
          this.slugAvailable = data.available;
          if (!data.available) this.slugError = data.reason ?? 'El subdominio ya está en uso';
        },
        error: () => { this.slugChecking = false; },
      });
    }, 400);
  }

  get slugPreview(): string {
    const slug = this.form.value.slug;
    return slug ? `${slug}.${this.baseDomain}` : '';
  }

  // ── Autocomplete de dirección ─────────────────────────────────────────────
  onAddressInput(): void {
    const q = this.form.value.address?.trim();
    this.selectedLat = null;
    this.selectedLng = null;
    this.mapUrl = null;
    this.addressSuggestions = [];
    if (!q || q.length < 4) return;
    if (this.addressTimer) clearTimeout(this.addressTimer);
    this.addressTimer = setTimeout(() => {
      this.addressSearching = true;
      this.http.get<any>(`${environment.apiUrl}/geocoding/autocomplete?query=${encodeURIComponent(q)}`).subscribe({
        next: (res: any) => {
          this.addressSuggestions = res?.data ?? res ?? [];
          this.addressSearching = false;
        },
        error: () => { this.addressSearching = false; },
      });
    }, 400);
  }

  selectAddress(s: { address: string; lat: number; lng: number }): void {
    this.form.patchValue({ address: s.address, lat: s.lat, lng: s.lng });
    this.selectedLat = s.lat;
    this.selectedLng = s.lng;
    this.addressSuggestions = [];
    const d = 0.008;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${s.lng-d},${s.lat-d},${s.lng+d},${s.lat+d}&layer=mapnik&marker=${s.lat},${s.lng}`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  clearAddress(): void {
    this.form.patchValue({ address: '', lat: null, lng: null });
    this.selectedLat = null; this.selectedLng = null;
    this.mapUrl = null; this.addressSuggestions = [];
  }

  selectPlan(id: string): void {
    this.form.patchValue({ plan: id });
  }

  get selectedPlan(): string { return this.form.value.plan; }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.slugAvailable === false) {
      const t = await this.toastCtrl.create({ message: 'El subdominio no está disponible', duration: 2500, color: 'danger', position: 'bottom' });
      await t.present();
      return;
    }
    if (this.slugAvailable === null) {
      const t = await this.toastCtrl.create({ message: 'Esperá a que se verifique el subdominio', duration: 2500, color: 'warning', position: 'bottom' });
      await t.present();
      return;
    }

    const loader = await this.loadingCtrl.create({ message: 'Registrando tu barbería...' });
    await loader.present();
    this.submitting = true;

    this.http.post<any>(`${environment.apiUrl}/barbershops/self-register`, this.form.value).subscribe({
      next: async (res) => {
        const barbershop = res?.data ?? res;
        this.newSlug = barbershop.slug;

        // Renovar token + sincronizar rol ADMIN_BARBERSHOP antes de mostrar éxito
        this.auth.refreshAndSync().subscribe({
          next: async () => {
            await loader.dismiss();
            this.submitting = false;
            this.success = true;
          },
          error: async () => {
            // Si el sync falla igual mostramos éxito — el usuario puede re-loguearse
            await loader.dismiss();
            this.submitting = false;
            this.success = true;
          },
        });
      },
      error: async (err) => {
        await loader.dismiss();
        this.submitting = false;
        const msg = err?.error?.error?.message ?? err?.error?.message ?? 'Error al registrar la barbería';
        const t = await this.toastCtrl.create({ message: msg, duration: 3500, color: 'danger', position: 'bottom' });
        await t.present();
      },
    });
  }

  goToBarbershop(): void {
    const token   = this.storage.get('accessToken')   || '';
    const refresh = this.storage.get('refreshToken')  || '';
    const user    = JSON.stringify(this.auth.currentUser || {});
    const hash    = `#auth=t=${encodeURIComponent(token)}&r=${encodeURIComponent(refresh)}&u=${encodeURIComponent(user)}`;
    const port     = window.location.port ? `:${window.location.port}` : '';
    const base     = environment.baseDomains[0];
    window.location.href = `${window.location.protocol}//${this.newSlug}.${base}${port}/tabs/home${hash}`;
  }

  goHome(): void {
    this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
  }
}
