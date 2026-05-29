import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { BarbershopResolverService } from '../../../core/barbershop-resolver.service';
import { NotificationsService } from '../../../services/notifications.service';
import { ActiveContextService } from '../../../core/active-context.service';
import { RoleSwitcherService } from '../../../core/role-switcher.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    public auth: AuthService,
    public notificationsService: NotificationsService,
    public activeCtx: ActiveContextService,
    private resolver: BarbershopResolverService,
    private roleSwitcher: RoleSwitcherService,
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated) {
      this.auth.setActiveRole('USUARIO');
      this.notificationsService.startSse(this.destroyRef);
    }
  }

  get isLoggedIn(): boolean { return this.auth.isAuthenticated; }
  get hasMultipleRoles(): boolean { return this.auth.getAvailableRoles().length > 1; }

  goToLogin(): void {
    const slug = this.resolver.slug;
    const port = window.location.port ? `:${window.location.port}` : '';
    const baseDomain = environment.baseDomains[0];
    window.location.href = `${window.location.protocol}//${baseDomain}${port}/auth/login?redirect=${slug}`;
  }

  async openRoleSwitcher(): Promise<void> {
    await this.roleSwitcher.open(this.auth.getAvailableRoles());
  }
}
