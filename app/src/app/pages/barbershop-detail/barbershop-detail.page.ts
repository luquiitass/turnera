import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AppBarbershopProfileComponent } from '../../shared/barbershop-profile/barbershop-profile.component';

@Component({
  standalone: false,
  selector: 'app-barbershop-detail',
  templateUrl: './barbershop-detail.page.html',
  styleUrls: ['./barbershop-detail.page.scss'],
})
export class BarbershopDetailPage implements OnInit {
  @ViewChild('profileComponent') profileComponent?: AppBarbershopProfileComponent;

  barbershopId: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.barbershopId = this.route.snapshot.paramMap.get('id')
      ?? this.route.snapshot.parent?.paramMap.get('id')
      ?? null;
  }
}
