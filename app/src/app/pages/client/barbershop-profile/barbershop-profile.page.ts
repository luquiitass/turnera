import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LoadingController, ToastController } from '@ionic/angular';
import { Location } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-barbershop-profile',
  templateUrl: './barbershop-profile.page.html',
  styleUrls: ['./barbershop-profile.page.scss'],
  standalone: false,
})
export class BarbershopProfilePage implements OnInit {
  barbershop: any = null;
  services: any[] = [];
  barbers: any[] = [];
  amenities: any[] = [];
  reviews: any[] = [];
  offers: any[] = [];

  loading = true;
  error = false;
  isAdmin = false;
  navigator = navigator;

  // Image viewer
  viewerImages: string[] = [];
  viewerIndex = 0;
  viewerSlideDir: 'left' | 'right' | null = null;
  private touchStartX = 0;

  get viewerUrl(): string | null {
    return this.viewerImages.length ? this.viewerImages[this.viewerIndex] : null;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private location: Location,
    private sanitizer: DomSanitizer,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadBarbershopProfile();
  }

  private async loadBarbershopProfile(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error = true; this.loading = false; return; }

    try {
      const response = await this.http
        .get<any>(`${environment.apiUrl}/barbershops/${id}`)
        .toPromise();

      this.barbershop = response.data || response;
      this.services   = this.barbershop.services  || [];
      this.barbers    = this.barbershop.barbers   || [];
      this.amenities  = this.barbershop.amenities || [];
      this.reviews    = this.barbershop.reviews   || [];
      this.offers     = this.barbershop.offers    || [];
      this.loading    = false;

      if (this.auth.isAuthenticated) {
        this.checkIfAdmin(id);
      }
    } catch {
      this.error = true;
      this.loading = false;
      this.showError('Error al cargar la información de la barbería');
    }
  }

  private checkIfAdmin(barbershopId: string): void {
    this.http.get<any>(`${environment.apiUrl}/users/me/barbershops`).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        const adminIds = (data.adminBarbershops ?? []).map((b: any) => b.id);
        this.isAdmin = adminIds.includes(barbershopId);
      },
      error: () => {},
    });
  }

  goToAdminPanel(): void {
    this.router.navigate(['/barbershop', this.barbershop.id]);
  }

  // ── Image helpers ──────────────────────────────────────────
  getBarbershopImage(type: string): string | null {
    return this.barbershop?.images?.find((i: any) => i.image?.type === type)?.image?.url ?? null;
  }

  getBarberPerfil(barber: any): string | null {
    return barber.images?.find((i: any) => i.image?.type === 'PERFIL')?.image?.url ?? null;
  }

  getBarberGallery(barber: any): string[] {
    return (barber.images ?? [])
      .filter((i: any) => i.image?.type === 'GALERIA')
      .map((i: any) => i.image.url);
  }

  getBarbershopGallery(): string[] {
    return (this.barbershop?.images ?? [])
      .filter((i: any) => i.image?.type === 'GALERIA')
      .map((i: any) => i.image.url);
  }

  formatPrice(n: number): string {
    return '$' + n.toLocaleString('es-AR');
  }

  // ── Location ───────────────────────────────────────────────
  getMapUrl(): SafeResourceUrl {
    const lat = this.barbershop?.latitude;
    const lng = this.barbershop?.longitude;
    const d   = 0.008;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  openDirections(): void {
    const lat = this.barbershop?.latitude;
    const lng = this.barbershop?.longitude;
    const dest = lat && lng ? `${lat},${lng}` : encodeURIComponent(this.barbershop?.address ?? '');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  }

  // ── Image viewer ───────────────────────────────────────────
  openViewer(images: string | string[], index = 0): void {
    this.viewerImages   = Array.isArray(images) ? images : [images];
    this.viewerIndex    = index;
    this.viewerSlideDir = null;
  }

  closeViewer(): void { this.viewerImages = []; }

  viewerPrev(): void {
    if (this.viewerIndex === 0) return;
    this.viewerSlideDir = 'right';
    setTimeout(() => { this.viewerIndex--; this.viewerSlideDir = null; }, 10);
  }

  viewerNext(): void {
    if (this.viewerIndex === this.viewerImages.length - 1) return;
    this.viewerSlideDir = 'left';
    setTimeout(() => { this.viewerIndex++; this.viewerSlideDir = null; }, 10);
  }

  onViewerTouchStart(e: TouchEvent): void { this.touchStartX = e.touches[0].clientX; }
  onViewerTouchEnd(e: TouchEvent): void {
    const delta = e.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(delta) < 50) return;
    delta < 0 ? this.viewerNext() : this.viewerPrev();
  }

  // ── Navigation ─────────────────────────────────────────────
  goToBooking(): void {
    if (!this.barbershop) return;
    this.router.navigate(['/booking'], { queryParams: { barbershopId: this.barbershop.id } });
  }

  shareBarber(): void {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: this.barbershop.name, text: `Descubre ${this.barbershop.name} en Turnera`, url });
    }
  }

  goBack(): void { this.location.back(); }

  private async showError(message: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 3000, position: 'top', color: 'danger' });
    await toast.present();
  }
}
