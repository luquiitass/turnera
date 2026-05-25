import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-super-admin-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class SuperAdminHomePage implements OnInit {
  dashboard: any = null;
  isLoading = false;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ionViewWillEnter(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.error = null;
    this.http.get<any>(`${environment.apiUrl}/stats/platform/dashboard`).subscribe({
      next: (res) => {
        this.dashboard = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el dashboard.';
        this.isLoading = false;
      },
    });
  }

  goToBarbershops(): void {
    this.router.navigateByUrl('/super_admin/tabs/barbershops');
  }

  goToUsers(): void {
    this.router.navigateByUrl('/super_admin/tabs/users');
  }
}
