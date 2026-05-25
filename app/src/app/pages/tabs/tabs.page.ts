import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../services/notifications.service';

@Component({
  standalone: false,
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage implements OnInit, OnDestroy {
  activeRole = 'USUARIO';
  availableRoles: string[] = [];
  private roleSub!: Subscription;

  // DestroyRef bound to this component's lifecycle; passed to startPolling so
  // the interval is cancelled automatically when this component is destroyed.
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private authService: AuthService,
    private actionSheetController: ActionSheetController,
    public notificationsService: NotificationsService,
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

  get isUsuario(): boolean {
    return this.activeRole === 'USUARIO';
  }

  get isAdmin(): boolean {
    return this.activeRole === 'ADMIN_BARBERSHOP' || this.activeRole === 'ADMIN_GENERAL';
  }

  get hasMultipleRoles(): boolean {
    return this.availableRoles.length > 1;
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      USUARIO: 'Usuario',
      ADMIN_BARBERSHOP: 'Admin de barberia',
      ADMIN_GENERAL: 'Administrador general',
    };
    return labels[role] ?? role;
  }

  async openRoleSwitcher(): Promise<void> {
    const buttons = this.availableRoles.map(role => ({
      text: this.getRoleLabel(role),
      icon: role === this.activeRole ? 'checkmark-circle-outline' : 'ellipse-outline',
      cssClass: role === this.activeRole ? 'active-role-button' : '',
      handler: () => {
        this.authService.setActiveRole(role);
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
