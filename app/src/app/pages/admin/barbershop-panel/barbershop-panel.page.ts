import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BarbershopsService } from '../../../services/barbershops.service';
import { AuthService } from '../../../core/services/auth.service';
import { Barbershop } from '../../../shared/models';

@Component({
  standalone: false,
  selector: 'app-barbershop-panel',
  templateUrl: './barbershop-panel.page.html',
  styleUrls: ['./barbershop-panel.page.scss'],
})
export class BarbershopPanelPage implements OnInit {
  barbershops: Barbershop[] = [];
  selectedBarbershop: Barbershop | null = null;
  isLoading = false;

  menuItems = [
    { icon: 'people-outline', label: 'Barberos', route: 'barbers' },
    { icon: 'cut-outline', label: 'Servicios', route: 'services' },
    { icon: 'calendar-outline', label: 'Reservas', route: 'bookings' },
    { icon: 'time-outline', label: 'Horarios', route: 'schedules' },
    { icon: 'cash-outline', label: 'Pagos', route: 'payments' },
    { icon: 'pricetag-outline', label: 'Ofertas', route: 'offers' },
    { icon: 'shield-outline', label: 'Sub-Admins', route: 'sub-admins' },
    { icon: 'stats-chart-outline', label: 'Estadisticas', route: 'stats' },
    { icon: 'settings-outline', label: 'Configuracion', route: 'settings' },
  ];

  constructor(
    private barbershopsService: BarbershopsService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadMyBarbershops();
  }

  loadMyBarbershops(): void {
    this.isLoading = true;
    this.barbershopsService.getMyBarbershops().subscribe({
      next: (res: any) => {
        this.barbershops = Array.isArray(res.data) ? res.data : [];
        if (this.barbershops.length > 0) {
          this.selectedBarbershop = this.barbershops[0];
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  selectBarbershop(barbershop: Barbershop): void {
    this.selectedBarbershop = barbershop;
  }

  goToSection(route: string): void {
    // TODO: implementar navegacion a subsecciones del admin
    console.log(`Navigate to ${route} for barbershop ${this.selectedBarbershop?.id}`);
  }

  goBack(): void {
    this.router.navigate(['/tabs/home']);
  }
}
