import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { StorageService } from '../../core/storage.service';

@Component({
  selector: 'app-barbershop-list',
  templateUrl: './barbershop-list.page.html',
  styleUrls: ['./barbershop-list.page.scss'],
  standalone: false,
})
export class BarbershopListPage implements OnInit {
  barbershops: any[] = [];
  loading = true;
  userName = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private storage: StorageService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser;
    this.userName = user?.firstName || '';
    this.loadBarbershops();
  }

  loadBarbershops(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/barbershops?limit=100`).subscribe({
      next: (res) => {
        this.barbershops = (res.data?.data ?? []).filter((bs: any) => bs.isActive);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  doRefresh(event: any): void {
    this.http.get<any>(`${environment.apiUrl}/barbershops?limit=100`).subscribe({
      next: (res) => {
        this.barbershops = (res.data?.data ?? []).filter((bs: any) => bs.isActive);
        event.target.complete();
      },
      error: () => { event.target.complete(); },
    });
  }

  goToBarbershop(barbershop: any): void {
    const slug = barbershop.slug;
    if (!slug) return;

    const token = this.storage.get('accessToken') || '';
    const refreshToken = this.storage.get('refreshToken') || '';
    const user = this.storage.get('currentUser') || '';
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const baseDomain = environment.baseDomains[0];

    const params = new URLSearchParams({ t: token, r: refreshToken, u: user });
    window.location.href = `${protocol}//${slug}.${baseDomain}${port}/tabs/home#auth=${params.toString()}`;
  }

  logout(): void {
    this.auth.logout();
  }
}
