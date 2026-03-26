import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BarbershopResolverService {
  private resolved = false;
  barbershop: any = null;

  constructor(private http: HttpClient) {}

  get slug(): string {
    const hostname = window.location.hostname;
    for (const base of environment.baseDomains) {
      if (hostname.endsWith(base) && hostname !== base) {
        const sub = hostname.replace(`.${base}`, '');
        if (sub && sub !== 'www') return sub;
      }
    }
    return '';
  }

  get hasSubdomain(): boolean {
    return this.slug !== '';
  }

  get isResolved(): boolean {
    return this.resolved;
  }

  resolve(): Promise<void> {
    if (this.resolved) return Promise.resolve();

    // Check for auth tokens in hash (coming from login redirect)
    this.consumeAuthHash();

    return new Promise((resolve) => {
      const slug = this.slug;

      if (!slug) {
        // No subdomain - base domain (login/barbershop-list)
        environment.appName = 'Turnera';
        document.title = 'Turnera';
        this.resolved = true;
        resolve();
        return;
      }

      this.http.get<any>(`${environment.apiUrl}/barbershops/by-slug/${slug}`).subscribe({
        next: (res) => {
          this.barbershop = res.data;
          environment.barbershopId = res.data.id;
          environment.appName = `Turnos ${res.data.name}`;
          this.resolved = true;
          document.title = environment.appName;
          resolve();
        },
        error: () => {
          console.error(`Barbershop not found for slug: ${slug}`);
          environment.appName = 'Barberia no encontrada';
          document.title = environment.appName;
          this.resolved = true;
          resolve();
        },
      });
    });
  }

  private consumeAuthHash(): void {
    const hash = window.location.hash;
    if (!hash.startsWith('#auth=')) return;

    try {
      const paramStr = hash.replace('#auth=', '');
      const params = new URLSearchParams(paramStr);
      const token = params.get('t');
      const refreshToken = params.get('r');
      const user = params.get('u');

      if (token) localStorage.setItem('accessToken', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      if (user) localStorage.setItem('currentUser', user);

      // Clean hash from URL
      window.history.replaceState(null, '', window.location.pathname);
    } catch (e) {
      console.error('Error consuming auth hash', e);
    }
  }
}
