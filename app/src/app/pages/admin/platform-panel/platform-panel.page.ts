import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-platform-panel',
  templateUrl: './platform-panel.page.html',
  styleUrls: ['./platform-panel.page.scss'],
})
export class PlatformPanelPage implements OnInit {
  dashboard: any = null;
  isLoading = false;
  error: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
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
      error: (err) => {
        this.error = 'No se pudo cargar el dashboard.';
        this.isLoading = false;
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/tabs/home']);
  }
}
