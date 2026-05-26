import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActiveContextService } from '../../../core/active-context.service';
import { AppBarbershopProfileComponent } from '../../../shared/barbershop-profile/barbershop-profile.component';

@Component({
  standalone: false,
  selector: 'app-barbershop-tab',
  templateUrl: './barbershop.page.html',
  styleUrls: ['./barbershop.page.scss'],
})
export class BarbershopTabPage implements OnInit {
  @ViewChild('profileComponent') profileComponent?: AppBarbershopProfileComponent;

  barbershopId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private activeContextService: ActiveContextService,
  ) {}

  ngOnInit(): void {
    // Prefer route param; fall back to active context (admin tab scenario)
    this.barbershopId = this.route.snapshot.paramMap.get('id')
      ?? this.activeContextService.barbershopId
      ?? null;
  }
}
