import { Component, OnInit, inject, DestroyRef } from '@angular/core';
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
}
