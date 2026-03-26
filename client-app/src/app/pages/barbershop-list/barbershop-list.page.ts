import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController, ToastController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { StorageService } from '../../core/storage.service';

@Component({
  selector: 'app-barbershop-list',
  templateUrl: './barbershop-list.page.html',
  styleUrls: ['./barbershop-list.page.scss'],
  standalone: false,
})
export class BarbershopListPage implements OnInit {
  barbershops: any[] = [];
  users: any[] = [];
  loading = true;
  userName = '';
  isAdmin = false;
  activeTab: 'barbershops' | 'users' = 'barbershops';

  // Platform stats
  dashboard: any = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private storage: StorageService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser;
    this.userName = user?.firstName || '';
    this.isAdmin = user?.roles?.includes('ADMIN_GENERAL') || false;
    this.loadBarbershops();
    if (this.isAdmin) this.loadDashboard();
  }

  loadBarbershops(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/barbershops?limit=100`).subscribe({
      next: (res) => {
        this.barbershops = (res.data?.data ?? []).filter((bs: any) => bs.isActive);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  loadDashboard(): void {
    this.http.get<any>(`${environment.apiUrl}/stats/platform/dashboard`).subscribe({
      next: (res) => { this.dashboard = res.data; },
    });
  }

  loadUsers(): void {
    this.http.get<any>(`${environment.apiUrl}/users?limit=100`).subscribe({
      next: (res) => { this.users = res.data?.data ?? []; },
    });
  }

  onTabChange(tab: 'barbershops' | 'users'): void {
    this.activeTab = tab;
    if (tab === 'users' && this.users.length === 0) this.loadUsers();
  }

  doRefresh(event: any): void {
    this.http.get<any>(`${environment.apiUrl}/barbershops?limit=100`).subscribe({
      next: (res) => {
        this.barbershops = (res.data?.data ?? []).filter((bs: any) => bs.isActive);
        if (this.isAdmin) this.loadDashboard();
        event.target.complete();
      },
      error: () => { event.target.complete(); },
    });
  }

  goToBarbershop(barbershop: any): void {
    const slug = barbershop.slug;
    if (!slug) return;
    const token = this.storage.get('accessToken') || '';
    const refreshToken = this.storage.get('refreshToken') || '';
    const user = this.storage.get('currentUser') || '';
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const baseDomain = environment.baseDomains[0];
    const params = new URLSearchParams({ t: token, r: refreshToken, u: user });
    window.location.href = `${protocol}//${slug}.${baseDomain}${port}/tabs/home#auth=${params.toString()}`;
  }

  // ==================== ADMIN ACTIONS ====================

  async createBarbershop(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Nueva barberia',
      message: 'El email debe ser de un usuario registrado.',
      inputs: [
        { name: 'adminEmail', type: 'email', placeholder: 'Email del administrador' },
        { name: 'name', type: 'text', placeholder: 'Nombre de la barberia' },
        { name: 'address', type: 'text', placeholder: 'Direccion' },
        { name: 'phone', type: 'tel', placeholder: 'Telefono (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Crear',
          handler: (data) => {
            if (!data.adminEmail || !data.name || !data.address) return false;
            this.http.post<any>(`${environment.apiUrl}/barbershops`, data).subscribe({
              next: () => { this.toast('Barberia creada', 'success'); this.loadBarbershops(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async generateOrder(): Promise<void> {
    this.http.post<any>(`${environment.apiUrl}/registration/create-order`, { expiresInDays: 7 }).subscribe({
      next: async (res: any) => {
        const code = res.data.code;
        const port = window.location.port ? `:${window.location.port}` : '';
        const protocol = window.location.protocol;
        const baseDomain = environment.baseDomains[0];
        const link = `${protocol}//${baseDomain}${port}/auth/login?redirect=create-barber&code=${code}`;
        const alert = await this.alertCtrl.create({
          header: 'Orden generada',
          message: `Codigo: ${code}`,
          inputs: [{ name: 'link', type: 'url', value: link }],
          buttons: [
            { text: 'Copiar', handler: () => { navigator.clipboard.writeText(link); this.toast('Enlace copiado', 'success'); return false; } },
            { text: 'Cerrar' },
          ],
        });
        await alert.present();
      },
      error: () => this.toast('Error al generar orden', 'danger'),
    });
  }

  async assignRole(user: any): Promise<void> {
    const roles = ['ADMIN_GENERAL', 'ADMIN_BARBERSHOP', 'SUB_ADMIN', 'USUARIO'];
    const inputs = roles.map(r => ({
      type: 'checkbox' as const,
      label: r,
      value: r,
      checked: user.roles?.includes(r),
    }));
    const alert = await this.alertCtrl.create({
      header: `Roles - ${user.firstName}`,
      inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (selected: string[]) => {
            this.http.post<any>(`${environment.apiUrl}/users/assign-role`, { email: user.email, roles: selected }).subscribe({
              next: () => { this.toast('Roles actualizados', 'success'); this.loadUsers(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  getRoleLabel(roles: string[]): string {
    return (roles || []).join(', ');
  }

  logout(): void {
    this.auth.logout();
  }

  async toast(msg: string, color = 'warning'): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color, position: 'bottom' });
    await t.present();
  }
}
