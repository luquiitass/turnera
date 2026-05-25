import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsService } from '../../../services/notifications.service';

@Component({
  standalone: false,
  selector: 'app-barber-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class BarberTabsPage implements OnInit, OnDestroy {
  activeRole = 'BARBERO';
  availableRoles: string[] = [];
  private roleSub!: Subscription;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    public authService: AuthService,
    private actionSheetController: ActionSheetController,
    public notificationsService: NotificationsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.roleSub = this.authService.activeRole$.subscribe(role => {
      this.activeRole = role;
      this.availableRoles = this.authService.getAvailableRoles();
    });
    this.notificationsService.startSse(this.destroyRef);
  }

  ngOnDestroy(): void {
    this.roleSub?.unsubscribe();
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
    const buttons = this.availableRoles.map(role => ({
      text: this.getRoleLabel(role),
      icon: role === this.activeRole ? 'checkmark-circle-outline' : 'ellipse-outline',
      cssClass: role === this.activeRole ? 'active-role-button' : '',
      handler: () => {
        this.authService.setActiveRole(role);
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
