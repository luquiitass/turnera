import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AppBarbershopProfileComponent } from './barbershop-profile.component';
import { SharedComponentsModule } from '../shared-components.module';
import { BankAccountComponent } from '../../pages/tabs/barbershop/bank-account/bank-account.component';

@NgModule({
  declarations: [AppBarbershopProfileComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule,
    SharedComponentsModule,
    BankAccountComponent,
  ],
  exports: [AppBarbershopProfileComponent],
})
export class BarbershopProfileModule {}
