import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ContextSubtitleComponent } from './context-subtitle.component';

@NgModule({
  declarations: [ContextSubtitleComponent],
  imports: [CommonModule, IonicModule],
  exports: [ContextSubtitleComponent],
})
export class ContextSubtitleModule {}
