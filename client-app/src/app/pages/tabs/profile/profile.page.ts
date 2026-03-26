import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../../../core/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  appName = environment.appName;
  user: any = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit(): void {
    this.auth.currentUser$.subscribe(u => (this.user = u));
  }

  doRefresh(event: any): void {
    this.auth.currentUser$.subscribe(u => { this.user = u; event.target.complete(); });
  }

  getInitials(): string {
    if (!this.user) return '?';
    const first = this.user.firstName?.[0] ?? '';
    const last = this.user.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  }

  async confirmLogout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar sesion',
      message: '¿Estas seguro que deseas cerrar sesion?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar sesion',
          role: 'destructive',
          handler: () => this.doLogout(),
        },
      ],
    });
    await alert.present();
  }

  private doLogout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/auth/login');
  }
}
