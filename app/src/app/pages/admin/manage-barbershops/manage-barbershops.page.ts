import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ModalController, ToastController } from '@ionic/angular';
import { BarbershopsService } from '../../../services/barbershops.service';
import { GeocodingService } from '../../../core/geocoding.service';
import { CreateBarbershopModalComponent } from '../create-barbershop-modal/create-barbershop-modal.component';
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
    private geocodingService: GeocodingService,
    private loadingController: LoadingController,
    private modalController: ModalController,
    private toastController: ToastController,
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
    const modal = await this.modalController.create({
      component: CreateBarbershopModalComponent,
      cssClass: 'create-barbershop-modal',
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss();

    if (role === 'create' && data) {
      // data ya incluye latitude y longitude
      await this.submitCreateBarbershop(data);
    }
  }

  private async submitCreateBarbershop(data: any): Promise<void> {
    const loader = await this.loadingController.create({
      message: 'Creando barberia...',
    });
    await loader.present();

    this.barbershopsService.create({
      adminEmail: data.adminEmail,
      name: data.name,
      address: data.formattedAddress,
      latitude: data.latitude,
      longitude: data.longitude,
      phone: data.phone || undefined,
    } as any).subscribe({
      next: async () => {
        await loader.dismiss();
        await this.showSuccess('Barberia creada con éxito');
        this.loadBarbershops();
      },
      error: async (err: any) => {
        await loader.dismiss();
        const msg = err?.error?.error?.message || 'Error al crear barberia';
        await this.showError(msg);
      },
    });
  }

  private async showSuccess(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
