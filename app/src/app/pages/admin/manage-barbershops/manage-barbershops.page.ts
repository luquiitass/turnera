import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { BarbershopsService } from '../../../services/barbershops.service';
import { Barbershop } from '../../../shared/models';

@Component({
  standalone: false,
  selector: 'app-manage-barbershops',
  templateUrl: './manage-barbershops.page.html',
  styleUrls: ['./manage-barbershops.page.scss'],
})
export class ManageBarbershopsPage implements OnInit {
  barbershops: Barbershop[] = [];
  isLoading = false;

  constructor(
    private barbershopsService: BarbershopsService,
    private alertController: AlertController,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadBarbershops();
  }

  ionViewWillEnter(): void {
    this.loadBarbershops();
  }

  loadBarbershops(): void {
    this.isLoading = true;
    this.barbershopsService.getAll({ limit: 100 }).subscribe({
      next: (res: any) => {
        this.barbershops = res.data.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  goToDetail(barbershop: Barbershop): void {
    this.router.navigate(['/barbershop', barbershop.id]);
  }

  async createBarbershop(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Nueva barberia',
      message: 'El email del administrador debe ser de un usuario registrado.',
      inputs: [
        { name: 'adminEmail', type: 'email', placeholder: 'Email del administrador' },
        { name: 'name', type: 'text', placeholder: 'Nombre de la barberia' },
        { name: 'address', type: 'text', placeholder: 'Direccion' },
        { name: 'phone', type: 'tel', placeholder: 'Telefono (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Crear',
          handler: (data: any) => {
            if (!data.adminEmail || !data.name || !data.address) {
              return false;
            }
            this.barbershopsService.create({
              adminEmail: data.adminEmail,
              name: data.name,
              address: data.address,
              phone: data.phone || undefined,
            } as any).subscribe({
              next: () => this.loadBarbershops(),
              error: (err: any) => {
                const msg = err?.error?.error?.message || 'Error al crear barberia';
                this.alertController.create({
                  header: 'Error', message: msg, buttons: ['OK'],
                }).then(a => a.present());
              },
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }
}
