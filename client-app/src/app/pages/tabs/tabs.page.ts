import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BarbershopResolverService } from '../../core/barbershop-resolver.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor(public auth: AuthService, private resolver: BarbershopResolverService) {}

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated;
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
