import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ActiveContextService } from './active-context.service';
import { AdminBarbershopService } from './admin-barbershop.service';
import { environment } from '../../environments/environment';

const ROLE_ROUTES: Record<string, string> = {
  USUARIO:          '/tabs/home',
  ADMIN_BARBERSHOP: '/admin/tabs/home',
  SUB_ADMIN:        '/admin/tabs/home',
  BARBERO:          '/barber/tabs/home',
  ADMIN_GENERAL:    '/super_admin/tabs/home',
};

const ROLE_LABELS: Record<string, string> = {
  USUARIO:          'Cliente',
  ADMIN_BARBERSHOP: 'Admin de barbería',
  SUB_ADMIN:        'Encargado',
  BARBERO:          'Barbero',
  ADMIN_GENERAL:    'Super Admin',
};

type Barbershop = { id: string; name: string };

@Injectable({ providedIn: 'root' })
export class RoleSwitcherService {

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private router: Router,
    private actionSheet: ActionSheetController,
    private activeCtx: ActiveContextService,
    private adminBarbershop: AdminBarbershopService,
  ) {}

  async open(availableRoles: string[]): Promise<void> {
    const currentRole = this.auth.activeRole;

    // Precargar barberías en background mientras el usuario lee el primer ActionSheet
    const bsCache: Record<string, Promise<Barbershop[]>> = {};
    for (const role of availableRoles) {
      if (['ADMIN_BARBERSHOP', 'SUB_ADMIN', 'BARBERO'].includes(role)) {
        bsCache[role] = this.loadBarbershopsForRole(role);
      }
    }

    // Mostrar selector de rol — capturamos la selección via closure
    let selectedRole: string | null = null;

    const buttons = availableRoles.map(role => ({
      text: ROLE_LABELS[role] ?? role,
      icon: role === currentRole ? 'checkmark-circle-outline' : 'ellipse-outline',
      cssClass: role === currentRole ? 'active-role-button' : '',
      handler: () => { selectedRole = role; },
    }));
    buttons.push({ text: 'Cancelar', icon: 'close-outline', handler: () => {} } as any);

    const sheet = await this.actionSheet.create({ header: 'Cambiar modo de uso', buttons });
    await sheet.present();
    await sheet.onDidDismiss(); // Esperar que cierre la animación

    if (!selectedRole) return; // Canceló

    // Datos precargados: en la mayoría de casos ya están listos
    const barbershops = await (bsCache[selectedRole] ?? Promise.resolve([]));
    await this.handleRoleWithData(selectedRole, barbershops);
  }

  // ── Manejo del rol seleccionado ────────────────────────────────────────────

  private async handleRoleWithData(role: string, barbershops: Barbershop[]): Promise<void> {
    if (role === 'USUARIO' || role === 'ADMIN_GENERAL') {
      this.auth.setActiveRole(role);
      this.activeCtx.clear();
      this.router.navigateByUrl(ROLE_ROUTES[role]);
      return;
    }

    if (barbershops.length === 0) {
      this.auth.setActiveRole(role);
      this.activeCtx.clear();
      this.router.navigateByUrl(ROLE_ROUTES[role]);
      return;
    }

    if (barbershops.length === 1) {
      this.applyContext(role, barbershops[0].id, barbershops[0].name);
      return;
    }

    // Múltiples barberías → picker inmediato (datos ya cargados)
    await this.showBarbershopPicker(role, barbershops);
  }

  private async showBarbershopPicker(role: string, barbershops: Barbershop[]): Promise<void> {
    const prev = this.activeCtx.getForRole(role);
    let selectedBs: Barbershop | null = null;

    const buttons = barbershops.map(bs => ({
      text: bs.name,
      icon: prev?.barbershopId === bs.id ? 'checkmark-circle-outline' : 'storefront-outline',
      cssClass: prev?.barbershopId === bs.id ? 'active-role-button' : '',
      handler: () => { selectedBs = bs; },
    }));
    buttons.push({ text: 'Cancelar', icon: 'close-outline', handler: () => {} } as any);

    const sheet = await this.actionSheet.create({
      header: `${ROLE_LABELS[role]} — Seleccioná la barbería`,
      buttons,
    });
    await sheet.present();
    await sheet.onDidDismiss();

    if (!selectedBs) return;
    this.applyContext(role, (selectedBs as Barbershop).id, (selectedBs as Barbershop).name);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async loadBarbershopsForRole(role: string): Promise<Barbershop[]> {
    try {
      if (role === 'ADMIN_BARBERSHOP' || role === 'SUB_ADMIN') {
        const res: any = await firstValueFrom(
          this.http.get<any>(`${environment.apiUrl}/users/me/barbershops`)
        );
        return (res?.data?.adminBarbershops ?? []).map((bs: any) => ({ id: bs.id, name: bs.name }));
      }
      if (role === 'BARBERO') {
        const res: any = await firstValueFrom(
          this.http.get<any>(`${environment.apiUrl}/barbers/my-profile`)
        );
        return (res?.data ?? []).map((p: any) => ({
          id: p.barbershopId, name: p.barbershop?.name ?? p.barbershopId,
        }));
      }
    } catch { /* silencio */ }
    return [];
  }

  private applyContext(role: string, barbershopId: string, barbershopName: string): void {
    this.auth.setActiveRole(role);
    if (barbershopId) {
      this.activeCtx.set(role, barbershopId, barbershopName);
      if (role === 'ADMIN_BARBERSHOP' || role === 'SUB_ADMIN') {
        if (this.adminBarbershop.barbershops.length > 0) {
          this.adminBarbershop.selectById(barbershopId);
        } else {
          this.adminBarbershop.load();
        }
      }
    } else {
      this.activeCtx.clear();
    }
    this.router.navigateByUrl(ROLE_ROUTES[role]);
  }
}
