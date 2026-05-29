import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ThemeService, AppTheme, THEME_OPTIONS, ThemeOption } from '../../../../core/theme.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  appName = environment.appName;
  user: any = null;
  themes: ThemeOption[] = THEME_OPTIONS;
  activeTheme: AppTheme = 'theme-light';

  adminBarbershops: any[] = [];
  barberBarbershops: any[] = [];

  // Edición
  editing = false;
  saving = false;
  uploadingPhoto = false;
  editForm = { firstName: '', lastName: '', phone: '', address: '' };

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private themeService: ThemeService,
    private storage: StorageService,
  ) {}

  get activeRole(): string       { return this.auth.activeRole; }
  get isAdminRole(): boolean     { return ['ADMIN_BARBERSHOP', 'SUB_ADMIN', 'ADMIN_GENERAL'].includes(this.activeRole); }
  get isBarberRole(): boolean    { return this.activeRole === 'BARBERO'; }
  get isSuperAdmin(): boolean    { return this.activeRole === 'ADMIN_GENERAL'; }
  get hasMultipleRoles(): boolean { return this.auth.getAvailableRoles().length > 1; }

  getRoleLabel(role: string): string {
    const map: Record<string, string> = {
      USUARIO: 'Cliente',
      ADMIN_BARBERSHOP: 'Administrador de barbería',
      SUB_ADMIN: 'Encargado',
      BARBERO: 'Barbero',
      ADMIN_GENERAL: 'Super Admin',
    };
    return map[role] ?? role;
  }

  ngOnInit(): void {
    this.auth.currentUser$.subscribe(u => (this.user = u));
    this.activeTheme = this.themeService.current();
    this.loadMyBarbershops();
  }

  doRefresh(event: any): void {
    this.auth.currentUser$.subscribe(u => { this.user = u; event.target.complete(); });
    this.loadMyBarbershops();
  }

  private loadMyBarbershops(): void {
    this.http.get<any>(`${environment.apiUrl}/users/me/barbershops`).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        this.adminBarbershops  = data.adminBarbershops  ?? [];
        this.barberBarbershops = data.barberBarbershops ?? [];
      },
      error: () => {},
    });
  }

  openBarberBarbershop(bs: any): void {
    if (bs.slug) {
      const token   = this.storage.get('accessToken') || '';
      const refresh = this.storage.get('refreshToken') || '';
      const user    = JSON.stringify(this.storage.getJson('currentUser') || {});
      const hash    = `#auth=t=${encodeURIComponent(token)}&r=${encodeURIComponent(refresh)}&u=${encodeURIComponent(user)}`;
      const port     = window.location.port ? `:${window.location.port}` : '';
      const base     = environment.baseDomains[0];
      window.location.href = `${window.location.protocol}//${bs.slug}.${base}${port}/tabs/home${hash}`;
    } else {
      this.router.navigateByUrl(`/barbershop/${bs.id}`);
    }
  }

  adminRoleLabel(role: string): string {
    const map: Record<string, string> = {
      ADMIN_BARBERSHOP: 'Administrador',
      SUB_ADMIN: 'Encargado',
      ADMIN_GENERAL: 'Admin general',
    };
    return map[role] ?? role;
  }

  selectTheme(theme: AppTheme): void {
    this.activeTheme = theme;
    this.themeService.apply(theme);
  }

  getInitials(): string {
    if (!this.user) return '?';
    const first = this.user.firstName?.[0] ?? '';
    const last  = this.user.lastName?.[0]  ?? '';
    return (first + last).toUpperCase() || '?';
  }

  // ── Edición ────────────────────────────────────────────────────────────────
  startEdit(): void {
    this.editForm = {
      firstName: this.user.firstName ?? '',
      lastName:  this.user.lastName  ?? '',
      phone:     this.user.phone     ?? '',
      address:   this.user.address   ?? '',
    };
    this.editing = true;
  }

  cancelEdit(): void {
    this.editing = false;
  }

  saveEdit(): void {
    if (!this.editForm.firstName.trim() || !this.editForm.lastName.trim()) {
      this.toast('El nombre y apellido son obligatorios', 'warning');
      return;
    }
    this.saving = true;
    this.http.put<any>(`${environment.apiUrl}/users/me`, {
      firstName: this.editForm.firstName.trim(),
      lastName:  this.editForm.lastName.trim(),
      phone:     this.editForm.phone.trim()   || undefined,
      address:   this.editForm.address.trim() || undefined,
    }).subscribe({
      next: (res: any) => {
        const updated = res?.data ?? res;
        // Actualizar en AuthService para que el nombre se refleje en toda la app
        if (updated?.id) {
          const storage = (this.auth as any).storage;
          if (storage) storage.setJson('currentUser', updated);
          (this.auth as any).currentUserSubject?.next(updated);
        }
        this.user = updated;
        this.saving = false;
        this.editing = false;
        this.toast('Perfil actualizado', 'success');
      },
      error: (err: any) => {
        this.saving = false;
        const msg = err?.error?.error?.message ?? 'Error al guardar los cambios';
        this.toast(msg, 'danger');
      },
    });
  }

  // ── Foto de perfil ────────────────────────────────────────────────────────
  triggerPhotoInput(): void {
    document.getElementById('profile-photo-input')?.click();
  }

  onPhotoSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    this.uploadingPhoto = true;
    const form = new FormData();
    form.append('file', file);
    form.append('type', 'PERFIL');

    this.http.post<any>(`${environment.apiUrl}/upload/image`, form).subscribe({
      next: (res: any) => {
        const avatarUrl = res?.data?.url ?? res?.url;
        if (!avatarUrl) { this.uploadingPhoto = false; this.toast('No se pudo obtener la URL de la imagen', 'danger'); return; }
        // Actualizar avatarUrl en el perfil del usuario
        this.http.put<any>(`${environment.apiUrl}/users/me`, { avatarUrl }).subscribe({
          next: (upd: any) => {
            const updated = upd?.data ?? upd;
            this.user = { ...this.user, avatarUrl };
            const storage = (this.auth as any).storage;
            if (storage) storage.setJson('currentUser', updated ?? { ...this.user });
            (this.auth as any).currentUserSubject?.next(updated ?? this.user);
            this.uploadingPhoto = false;
            this.toast('Foto actualizada', 'success');
          },
          error: () => { this.uploadingPhoto = false; this.toast('Error al guardar la foto', 'danger'); },
        });
      },
      error: () => { this.uploadingPhoto = false; this.toast('Error al subir la imagen', 'danger'); },
    });
  }

  private async toast(message: string, color = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }

  // ── Sesión ─────────────────────────────────────────────────────────────────
  async confirmLogout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar sesion',
      message: '¿Estas seguro que deseas cerrar sesion?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Cerrar sesion', role: 'destructive', handler: () => this.doLogout() },
      ],
    });
    await alert.present();
  }

  private doLogout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/auth/login');
  }
}
