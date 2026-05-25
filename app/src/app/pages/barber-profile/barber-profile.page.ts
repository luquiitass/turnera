import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { BarbersService } from '../../services/barbers.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: false,
  selector: 'app-barber-profile',
  templateUrl: './barber-profile.page.html',
  styleUrls: ['./barber-profile.page.scss'],
})
export class BarberProfilePage implements OnInit {
  barberProfiles: any[] = [];
  selectedProfile: any = null;
  isLoading = true;
  error: string | null = null;

  constructor(
    private barbersService: BarbersService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading = true;
    this.error = null;
    this.barbersService.getMyProfile().subscribe({
      next: (res: any) => {
        this.barberProfiles = res.data;
        if (this.barberProfiles.length > 0) {
          this.selectedProfile = this.barberProfiles[0];
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.error?.message || 'No se pudo cargar el perfil de barbero';
        this.isLoading = false;
      },
    });
  }

  selectProfile(profile: any): void {
    this.selectedProfile = profile;
  }

  get avgRating(): number {
    if (!this.selectedProfile?.reviews?.length) return 0;
    const sum = this.selectedProfile.reviews.reduce((s: number, r: any) => s + r.rating, 0);
    return Math.round((sum / this.selectedProfile.reviews.length) * 10) / 10;
  }

  getStarArray(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  }

  async editBio(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Editar Bio',
      inputs: [
        { name: 'bio', type: 'textarea', placeholder: 'Cuenta sobre ti y tu experiencia...', value: this.selectedProfile?.bio || '' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            this.barbersService.update(this.selectedProfile.id, { bio: data.bio }).subscribe({
              next: () => {
                this.selectedProfile.bio = data.bio;
                this.showToast('Bio actualizada', 'success');
              },
              error: () => this.showToast('Error al actualizar', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async editAvatar(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Foto de perfil',
      message: 'La foto de perfil se gestiona desde el panel de la barbería.',
      buttons: [{ text: 'Entendido', role: 'cancel' }],
    });
    await alert.present();
  }

  async addPortfolioImage(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Agregar foto de trabajo',
      inputs: [
        { name: 'imageUrl', type: 'url', placeholder: 'URL de la imagen' },
        { name: 'caption', type: 'text', placeholder: 'Descripcion (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Agregar',
          handler: (data) => {
            if (!data.imageUrl) {
              this.showToast('La URL es obligatoria', 'warning');
              return false;
            }
            this.barbersService.addMyImage(data.imageUrl, data.caption).subscribe({
              next: (res: any) => {
                this.selectedProfile.images = [...(this.selectedProfile.images || []), res.data];
                this.showToast('Foto agregada', 'success');
              },
              error: () => this.showToast('Error al agregar foto', 'danger'),
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async removePortfolioImage(imageId: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar foto',
      message: 'Estas seguro de que quieres eliminar esta foto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'danger',
          handler: () => {
            this.barbersService.removeMyImage(imageId).subscribe({
              next: () => {
                this.selectedProfile.images = this.selectedProfile.images.filter((i: any) => i.id !== imageId);
                this.showToast('Foto eliminada', 'success');
              },
              error: () => this.showToast('Error al eliminar', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2000, color, position: 'bottom' });
    await toast.present();
  }
}
