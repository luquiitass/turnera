import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsService } from '../../../services/notifications.service';
import { ActiveContextService } from '../../../core/active-context.service';
import { RoleSwitcherService } from '../../../core/role-switcher.service';

@Component({
  standalone: false,
  selector: 'app-super-admin-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class SuperAdminTabsPage implements OnInit, OnDestroy {
  availableRoles: string[] = [];
  private roleSub!: Subscription;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    public authService: AuthService,
    public notificationsService: NotificationsService,
    public activeCtx: ActiveContextService,
    private roleSwitcher: RoleSwitcherService,
  ) {}

  ngOnInit(): void {
    this.authService.setActiveRole('ADMIN_GENERAL');
    this.roleSub = this.authService.activeRole$.subscribe(() => {
      this.availableRoles = this.authService.getAvailableRoles();
    });
    this.authService.currentUser$.subscribe(() => {
      this.availableRoles = this.authService.getAvailableRoles();
    });
    this.notificationsService.startSse(this.destroyRef);
  }

  ngOnDestroy(): void { this.roleSub?.unsubscribe(); }

  get hasMultipleRoles(): boolean { return this.availableRoles.length > 1; }

  async openRoleSwitcher(): Promise<void> {
    await this.roleSwitcher.open(this.availableRoles);
  }
}
