import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AlertController, ModalController, ToastController, IonicModule } from '@ionic/angular';
import { BarbershopsService } from '../../../services/barbershops.service';
import { GeocodingService } from '../../../core/geocoding.service';
import { CreateBarbershopModalComponent } from '../create-barbershop-modal/create-barbershop-modal.component';
import { Barbershop } from '../../../shared/models';

@Component({
  standalone: true,
  // eslint-disable-next-line @angular-eslint/no-unused-imports -- required by ModalController.create()
  imports: [CommonModule, IonicModule, CreateBarbershopModalComponent],
  selector: 'app-manage-barbershops',
  templateUrl: './manage-barbershops.page.html',
  styleUrls: ['./manage-barbershops.page.scss'],
})
export class ManageBarbershopsPage implements OnInit {
  barbershops: Barbershop[] = [];
  isLoading = false;
  togglingId: string | null = null;

  constructor(
    private barbershopsService: BarbershopsService,
    private router: Router,
    private geocodingService: GeocodingService,
    private modalController: ModalController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.loadBarbershops();
  }

  ionViewWillEnter(): void {
    this.loadBarbershops();
  }

  loadBarbershops(): void {
    this.isLoading = true;
    this.barbershopsService.getAllAdmin().subscribe({
      next: (res: any) => {
        this.barbershops = res.data;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
  }

  goToDetail(barbershop: Barbershop): void {
    this.router.navigate([`/admin/barbershop/${barbershop.id}`]);
  }

  async toggleActive(event: Event, barbershop: Barbershop): Promise<void> {
    event.stopPropagation();
    const action = barbershop.isActive ? 'inactivar' : 'activar';
    const alert = await this.alertCtrl.create({
      header: barbershop.isActive ? 'Inactivar barbería' : 'Activar barbería',
      message: barbershop.isActive
        ? `¿Inactivar <strong>${barbershop.name}</strong>? Dejará de ser visible para los clientes.`
        : `¿Activar <strong>${barbershop.name}</strong>? Volverá a estar visible para los clientes.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: barbershop.isActive ? 'Inactivar' : 'Activar',
          role: 'destructive',
          handler: () => this.doToggle(barbershop),
        },
      ],
    });
    await alert.present();
  }

  private doToggle(barbershop: Barbershop): void {
    this.togglingId = barbershop.id;
    const req = barbershop.isActive
      ? this.barbershopsService.deactivate(barbershop.id)
      : this.barbershopsService.activate(barbershop.id);

    req.subscribe({
      next: async () => {
        barbershop.isActive = !barbershop.isActive;
        this.togglingId = null;
        const toast = await this.toastCtrl.create({
          message: barbershop.isActive ? 'Barbería activada' : 'Barbería inactivada',
          duration: 2000,
          color: barbershop.isActive ? 'success' : 'warning',
          position: 'bottom',
        });
        await toast.present();
      },
      error: async () => {
        this.togglingId = null;
        const toast = await this.toastCtrl.create({
          message: 'Error al cambiar el estado',
          duration: 2000,
          color: 'danger',
          position: 'bottom',
        });
        await toast.present();
      },
    });
  }

  async createBarbershop(): Promise<void> {
    const modal = await this.modalController.create({
      component: CreateBarbershopModalComponent,
      componentProps: {},
      cssClass: 'modal-overlay',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'success') this.loadBarbershops();
  }
}
