import { Component } from '@angular/core';
import { ActiveContextService } from '../../core/active-context.service';

@Component({
  selector: 'app-context-subtitle',
  template: `
    <ion-toolbar color="primary" class="ctx-subtitle-toolbar" *ngIf="ctx.barbershopName">
      <ion-title size="small" class="ctx-subtitle">
        <ion-icon name="storefront-outline"></ion-icon>
        {{ ctx.barbershopName }}
      </ion-title>
    </ion-toolbar>
  `,
  styles: [`
    .ctx-subtitle-toolbar {
      --min-height: 30px;
      --padding-top: 0;
      --padding-bottom: 0;
    }
    .ctx-subtitle {
      font-size: 0.75rem !important;
      font-weight: 500;
      opacity: 0.88;
      display: flex;
      align-items: center;
      gap: 5px;
      ion-icon { font-size: 13px; }
    }
  `],
  standalone: false,
})
export class ContextSubtitleComponent {
  constructor(public ctx: ActiveContextService) {}
}
