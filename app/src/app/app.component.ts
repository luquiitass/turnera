import { Component, OnInit } from '@angular/core';
import { ThemeService } from './core/theme.service';
import { PushService } from './core/push.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private themeService: ThemeService,
    private pushService: PushService,
  ) {}

  ngOnInit(): void {
    this.themeService.load();
    this.pushService.init();
  }
}
