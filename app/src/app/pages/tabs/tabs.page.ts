import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../services/notifications.service';
import { AdminBarbershopService } from '../../core/admin-barbershop.service';
import { ActiveContextService } from '../../core/active-context.service';
import { RoleSwitcherService } from '../../core/role-switcher.service';

@Component({
  standalone: false,
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage implements OnInit, OnDestroy {
  availableRoles: string[] = [];
  private roleSub!: Subscription;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    public authService: AuthService,
    public notificationsService: NotificationsService,
    public adminBarbershop: AdminBarbershopService,
    public activeCtx: ActiveContextService,
    private roleSwitcher: RoleSwitcherService,
  ) {}

  ngOnInit(): void {
    const roles = this.authService.currentUser?.roles ?? [];
    const adminRole = roles.includes('ADMIN_BARBERSHOP') ? 'ADMIN_BARBERSHOP'
                    : roles.includes('SUB_ADMIN')        ? 'SUB_ADMIN'
                    : 'ADMIN_BARBERSHOP';
    this.authService.setActiveRole(adminRole);

    // Aplicar contexto guardado para este rol si existe
    const saved = this.activeCtx.getForRole(adminRole);
    if (saved) {
      this.adminBarbershop.selectById(saved.barbershopId);
    } else {
      this.adminBarbershop.load();
    }

    this.roleSub = this.authService.activeRole$.subscribe(() => {
      this.availableRoles = this.authService.getAvailableRoles();
    });
    this.authService.currentUser$.subscribe(() => {
      this.availableRoles = this.authService.getAvailableRoles();
    });
    this.notificationsService.startSse(this.destroyRef);
  }

  onBarbershopSelect(event: any): void {
    this.adminBarbershop.selectById(event.detail.value as string);
  }

  ngOnDestroy(): void { this.roleSub?.unsubscribe(); }

  get hasMultipleRoles(): boolean { return this.availableRoles.length > 1; }

  async openRoleSwitcher(): Promise<void> {
    await this.roleSwitcher.open(this.availableRoles);
  }
}
