import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ModalController, ToastController, IonicModule } from '@ionic/angular';
import { BarbershopsService } from '../../../services/barbershops.service';
import { GeocodingService } from '../../../core/geocoding.service';
import { CreateBarbershopModalComponent } from '../create-barbershop-modal/create-barbershop-modal.component';
import { Barbershop } from '../../../shared/models';

@Component({
  standalone: true,
  imports: [CommonModule, IonicModule, CreateBarbershopModalComponent],
  selector: 'app-manage-barbershops',
  templateUrl: './manage-barbershops.page.html',
  styleUrls: ['./manage-barbershops.page.scss'],
})
export class ManageBarbershopsPage implements OnInit {
  barbershops: Barbershop[] = [];
  isLoading = false;

  constructor(
    private barbershopsService: BarbershopsService,
    private router: Router,
    private geocodingService: GeocodingService,
    private modalController: ModalController,
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
    this.router.navigate([`/admin/barbershops/${barbershop.id}`]);
  }

  async createBarbershop(): Promise<void> {
    const modal = await this.modalController.create({
      component: CreateBarbershopModalComponent,
      componentProps: {},
      cssClass: 'modal-overlay',
    });

    await modal.present();
    const { role } = await modal.onDidDismiss();

    // Si el modal se cerró exitosamente, recargar lista
    if (role === 'success') {
      this.loadBarbershops();
    }
  }
}
