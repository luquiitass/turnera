import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, AlertController, LoadingController } from '@ionic/angular';
import { BankAccountsService, BankAccount, CreateBankAccountDto } from '../../../../core/services/bank-accounts.service';

@Component({
  standalone: true,
  selector: 'app-bank-account',
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './bank-account.component.html',
})
export class BankAccountComponent implements OnInit {
  @Input() barbershopId!: string;

  accounts: BankAccount[] = [];
  showForm = false;
  isLoading = false;

  form: Partial<CreateBankAccountDto> = {
    accountType: 'CBU',
    isPrimary: true,
  };

  constructor(
    private bankAccountsService: BankAccountsService,
    private toast: ToastController,
    private alert: AlertController,
    private loading: LoadingController,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.bankAccountsService.getByBarbershop(this.barbershopId).subscribe({
      next: (accounts) => this.accounts = accounts,
      error: () => this.showToast('Error al cargar cuentas', 'danger'),
    });
  }

  save() {
    if (!this.form.cbuCvu || !this.form.holderName || !this.form.holderCuit) {
      this.showToast('Completá CBU/CVU, titular y CUIT', 'warning');
      return;
    }

    this.isLoading = true;
    const dto: CreateBankAccountDto = {
      barbershopId: this.barbershopId,
      accountType: this.form.accountType as 'CBU' | 'CVU',
      cbuCvu: this.form.cbuCvu!,
      alias: this.form.alias,
      bankName: this.form.bankName,
      holderName: this.form.holderName!,
      holderCuit: this.form.holderCuit!,
      accountCategory: this.form.accountCategory as any,
      isPrimary: this.form.isPrimary ?? true,
    };

    this.bankAccountsService.create(dto).subscribe({
      next: () => {
        this.showToast('Cuenta guardada correctamente', 'success');
        this.showForm = false;
        this.form = { accountType: 'CBU', isPrimary: true };
        this.load();
        this.isLoading = false;
      },
      error: () => {
        this.showToast('Error al guardar la cuenta', 'danger');
        this.isLoading = false;
      },
    });
  }

  async confirmRemove(account: BankAccount) {
    const alertEl = await this.alert.create({
      header: 'Eliminar cuenta',
      message: `¿Eliminar ${account.cbuCvu ?? 'cuenta MP'}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar', role: 'destructive',
          handler: () => {
            this.bankAccountsService.remove(account.id).subscribe({
              next: () => { this.showToast('Cuenta eliminada', 'medium'); this.load(); },
              error: () => this.showToast('Error al eliminar', 'danger'),
            });
          },
        },
      ],
    });
    await alertEl.present();
  }

  setPrimary(account: BankAccount) {
    this.bankAccountsService.setPrimary(account.id).subscribe({
      next: () => { this.showToast('Cuenta principal actualizada', 'success'); this.load(); },
      error: () => this.showToast('Error al actualizar', 'danger'),
    });
  }

  async connectMercadoPago() {
    const loading = await this.loading.create({ message: 'Conectando con MercadoPago...' });
    await loading.present();

    this.bankAccountsService.getMpOAuthUrl(this.barbershopId).subscribe({
      next: ({ url }) => {
        loading.dismiss();
        window.location.href = url;
      },
      error: () => {
        loading.dismiss();
        this.showToast('Error al iniciar conexión con MP', 'danger');
      },
    });
  }

  async disconnectMercadoPago() {
    const alertEl = await this.alert.create({
      header: 'Desconectar MercadoPago',
      message: 'Se desactivará la cuenta MP. Los pagos usarán el CBU/CVU configurado.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desconectar',
          handler: () => {
            this.bankAccountsService.disconnectMpOAuth(this.barbershopId).subscribe({
              next: () => { this.showToast('Cuenta MP desconectada', 'medium'); this.load(); },
              error: () => this.showToast('Error al desconectar', 'danger'),
            });
          },
        },
      ],
    });
    await alertEl.present();
  }

  get mpAccount(): BankAccount | undefined {
    return this.accounts.find(a => a.accountType === 'MP_OAUTH');
  }

  get bankAccounts(): BankAccount[] {
    return this.accounts.filter(a => a.accountType !== 'MP_OAUTH');
  }

  private async showToast(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
