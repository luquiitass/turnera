import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../shared/models';

@Component({
  standalone: false,
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit, OnDestroy {
  currentUser: User | null = null;
  activeRole = 'USUARIO';
  availableRoles: string[] = [];

  private userSub!: Subscription;
  private roleSub!: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
  ) {}

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.availableRoles = this.authService.getAvailableRoles();
    });
    this.roleSub = this.authService.activeRole$.subscribe(role => {
      this.activeRole = role;
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.roleSub?.unsubscribe();
  }

  get fullName(): string {
    if (!this.currentUser) return '';
    return `${this.currentUser.firstName} ${this.currentUser.lastName}`;
  }

  get initials(): string {
    if (!this.currentUser) return '?';
    const first = this.currentUser.firstName?.charAt(0) ?? '';
    const last = this.currentUser.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }

  get hasMultipleRoles(): boolean {
    return this.availableRoles.length > 1;
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      USUARIO: 'Usuario',
      ADMIN_BARBERSHOP: 'Admin de barberia',
      ADMIN_GENERAL: 'Administrador general',
    };
    return labels[role] ?? role;
  }

  switchRole(role: string): void {
    this.authService.setActiveRole(role);
  }

  async confirmLogout(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cerrar sesion',
      message: 'Estas seguro de que quieres cerrar sesion?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Cerrar sesion',
          role: 'destructive',
          handler: () => this.logout(),
        },
      ],
    });
    await alert.present();
  }

  private logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
