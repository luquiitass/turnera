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
  transactions: any = null;
  isLoading = false;
  error: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadTransactions();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.error = null;
    this.http.get<any>(`${environment.apiUrl}/stats/platform/dashboard`).subscribe({
      next: (res) => { this.dashboard = res.data; this.isLoading = false; },
      error: () => { this.error = 'No se pudo cargar el dashboard.'; this.isLoading = false; },
    });
  }

  loadTransactions(): void {
    this.http.get<any>(`${environment.apiUrl}/stats/platform/transactions?limit=50`).subscribe({
      next: (res) => { this.transactions = res.data; },
    });
  }

  formatPrice(n: number): string { return '$' + Math.round(n ?? 0).toLocaleString('es-AR'); }
  formatDate(d: string): string { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  getTransferColor(s: string): string {
    return { COMPLETED: 'success', FAILED: 'danger', PROCESSING: 'warning', PENDING: 'warning', NOT_REQUIRED: 'medium' }[s] ?? 'medium';
  }
  getTransferLabel(s: string): string {
    return { COMPLETED: 'Transferido', FAILED: 'Falló', PROCESSING: 'Procesando', PENDING: 'Pendiente', NOT_REQUIRED: 'N/A' }[s] ?? s;
  }
  getTypeLabel(t: string): string {
    return { commission: 'Comisión', subscription: 'Suscripción', subscription_booking: 'Reserva' }[t] ?? t;
  }

  goBack(): void {
    this.router.navigate(['/admin/tabs/home']);
  }
}
