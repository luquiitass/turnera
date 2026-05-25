import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { BarbershopResolverService } from '../../../core/barbershop-resolver.service';
import { NotificationsService } from '../../../services/notifications.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit {
  // DestroyRef is injected here so the polling subscription is automatically
  // cancelled when TabsPage is destroyed, preventing interval accumulation
  // if the component is ever re-created (e.g. after logout/login).
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    public auth: AuthService,
    public notificationsService: NotificationsService,
    private resolver: BarbershopResolverService,
    private actionSheetController: ActionSheetController,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated) {
      this.notificationsService.startSse(this.destroyRef);
    }
  }

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated;
  }

  get isAdmin(): boolean {
    const role = this.auth.activeRole;
    return ['ADMIN_BARBERSHOP', 'SUB_ADMIN', 'ADMIN_GENERAL'].includes(role);
  }

  goToLogin(): void {
    // Redirect to login on base domain (no subdomain) with slug as param
    const slug = this.resolver.slug;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    // Use first base domain (localhost in dev)
    const baseDomain = environment.baseDomains[0];
    window.location.href = `${protocol}//${baseDomain}${port}/auth/login?redirect=${slug}`;
  }

  private getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      USUARIO: 'Cliente',
      ADMIN_BARBERSHOP: 'Admin de barbería',
      SUB_ADMIN: 'Encargado',
      BARBERO: 'Barbero',
      ADMIN_GENERAL: 'Super Admin',
    };
    return labels[role] ?? role;
  }

  private readonly roleRoutes: Record<string, string> = {
    USUARIO: '/tabs/home',
    ADMIN_BARBERSHOP: '/admin/tabs/home',
    SUB_ADMIN: '/admin/tabs/home',
    BARBERO: '/barber/tabs/home',
    ADMIN_GENERAL: '/super_admin/tabs/home',
  };

  async openRoleSwitcher(): Promise<void> {
    const availableRoles = this.auth.getAvailableRoles();
    const activeRole = this.auth.activeRole;

    const buttons = availableRoles.map(role => ({
      text: this.getRoleLabel(role),
      icon: role === activeRole ? 'checkmark-circle-outline' : 'ellipse-outline',
      cssClass: role === activeRole ? 'active-role-button' : '',
      handler: () => {
        this.auth.setActiveRole(role);
        this.router.navigateByUrl(this.roleRoutes[role] ?? '/tabs/home');
      },
    }));

    buttons.push({
      text: 'Cancelar',
      icon: 'close-outline',
      cssClass: 'cancel-button',
      handler: () => true as any,
    });

    const actionSheet = await this.actionSheetController.create({
      header: 'Cambiar modo de uso',
      buttons,
    });
    await actionSheet.present();
  }
}
