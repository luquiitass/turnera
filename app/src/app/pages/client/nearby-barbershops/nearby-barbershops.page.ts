import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GeolocationService } from '../../../core/geolocation.service';
import { environment } from '../../../../environments/environment';

declare const L: any;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  selector: 'app-nearby-barbershops',
  templateUrl: './nearby-barbershops.page.html',
  styleUrls: ['./nearby-barbershops.page.scss'],
})
export class NearbyBarbershopsPage implements OnInit, OnDestroy {

  allBarbershops: any[] = [];   // todas cargadas del servidor
  displayList: any[]   = [];   // ordenadas por distancia

  loading    = true;
  hasLocation = false;
  radiusKm   = 5;              // radio configurable

  userLocation: { latitude: number; longitude: number } | null = null;
  selectedId:  string | null = null;
  searchQuery  = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private map:       any = null;
  private markers:   Map<string, any> = new Map();
  private radiusCircle: any = null;
  private userMarker:   any = null;

  constructor(
    private http:     HttpClient,
    private geo:      GeolocationService,
    private router:   Router,
    private zone:     NgZone,
  ) {}

  ngOnInit(): void {
    this.userLocation = this.geo.getStoredLocation();
    if (this.userLocation) this.hasLocation = true;
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.map) { this.map.remove(); this.map = null; }
  }

  // ── Cargar TODAS las barberías ────────────────────────────────────────
  loadAll(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/barbershops?limit=200`).subscribe({
      next: (res) => {
        const list: any[] = Array.isArray(res.data)
          ? res.data
          : (res.data?.data ?? []);
        this.zone.run(() => {
          this.allBarbershops = list;
          this.buildDisplayList();
          this.loading = false;
          this.initMap();
        });
      },
      error: () => { this.zone.run(() => { this.loading = false; }); },
    });
  }

  doRefresh(event: any): void {
    this.loadAll();
    setTimeout(() => event.target.complete(), 1500);
  }

  // ── Búsqueda con debounce ─────────────────────────────────────────────
  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilter(), 300);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilter();
  }

  private applyFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.buildDisplayList();
      this.updateMarkersVisibility(null);
      return;
    }
    const all = this.allBarbershops.map(b => ({
      ...b,
      _dist: b.latitude && b.longitude && this.userLocation
        ? this.haversine(this.userLocation.latitude, this.userLocation.longitude, b.latitude, b.longitude)
        : null,
    }));
    this.displayList = all
      .filter(b =>
        b.name?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (a._dist === null) return 1;
        if (b._dist === null) return -1;
        return a._dist - b._dist;
      });
    const visibleIds = new Set(this.displayList.map((b: any) => b.id));
    this.updateMarkersVisibility(visibleIds);
  }

  private updateMarkersVisibility(visibleIds: Set<string> | null): void {
    if (!this.map) return;
    this.markers.forEach((marker, id) => {
      if (!visibleIds || visibleIds.has(id)) {
        if (!this.map.hasLayer(marker)) marker.addTo(this.map);
      } else {
        if (this.map.hasLayer(marker)) marker.remove();
      }
    });
  }

  // ── Ordenar por distancia ─────────────────────────────────────────────
  private buildDisplayList(): void {
    if (!this.userLocation) {
      this.displayList = [...this.allBarbershops];
      return;
    }
    this.displayList = [...this.allBarbershops]
      .map(b => ({
        ...b,
        _dist: b.latitude && b.longitude
          ? this.haversine(this.userLocation!.latitude, this.userLocation!.longitude, b.latitude, b.longitude)
          : null,
      }))
      .sort((a, b) => {
        if (a._dist === null) return 1;
        if (b._dist === null) return -1;
        return a._dist - b._dist;
      });
  }

  // ── Inicializar mapa Leaflet ─────────────────────────────────────────
  private initMap(): void {
    if (typeof L === 'undefined') { setTimeout(() => this.initMap(), 300); return; }

    setTimeout(() => {
      const el = document.getElementById('leaflet-map');
      if (!el) return;
      if (this.map) { this.map.remove(); this.map = null; }

      // Centro: ubicación del usuario o primera barbería con coords
      const center = this.getMapCenter();
      this.map = L.map('leaflet-map', { zoomControl: true, attributionControl: false })
        .setView(center, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
        .addTo(this.map);

      this.drawUserLayer();
      this.drawMarkers();
    }, 150);
  }

  private getMapCenter(): [number, number] {
    if (this.userLocation) return [this.userLocation.latitude, this.userLocation.longitude];
    const first = this.allBarbershops.find(b => b.latitude && b.longitude);
    return first ? [first.latitude, first.longitude] : [-34.6, -58.38];
  }

  // ── Marcador y círculo del usuario ───────────────────────────────────
  private drawUserLayer(): void {
    if (!this.map || !this.userLocation) return;

    // Marcador de posición
    if (this.userMarker) this.userMarker.remove();
    const userIcon = L.divIcon({ className: '', html: `<div class="map-user-pin"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
    this.userMarker = L.marker([this.userLocation.latitude, this.userLocation.longitude], { icon: userIcon })
      .addTo(this.map)
      .bindPopup('Tu ubicación');

    // Círculo de radio
    if (this.radiusCircle) this.radiusCircle.remove();
    this.radiusCircle = L.circle(
      [this.userLocation.latitude, this.userLocation.longitude],
      {
        radius: this.radiusKm * 1000,
        color: 'var(--ion-color-primary, #3880ff)',
        fillColor: 'var(--ion-color-primary, #3880ff)',
        fillOpacity: 0.06,
        weight: 2,
        dashArray: '6 4',
      }
    ).addTo(this.map);
  }

  // ── Actualizar radio al mover el slider ──────────────────────────────
  onRadiusChange(): void {
    if (!this.map || !this.userLocation) return;
    if (this.radiusCircle) this.radiusCircle.remove();
    this.radiusCircle = L.circle(
      [this.userLocation.latitude, this.userLocation.longitude],
      {
        radius: this.radiusKm * 1000,
        color: 'var(--ion-color-primary, #3880ff)',
        fillColor: 'var(--ion-color-primary, #3880ff)',
        fillOpacity: 0.06,
        weight: 2,
        dashArray: '6 4',
      }
    ).addTo(this.map);
  }

  // ── Marcadores de barberías ───────────────────────────────────────────
  private drawMarkers(): void {
    if (!this.map) return;
    this.markers.clear();
    for (const bs of this.allBarbershops) {
      if (!bs.latitude || !bs.longitude) continue;
      const icon = L.divIcon({ className: '', html: `<div class="map-bs-pin">✂</div>`, iconSize: [34, 34], iconAnchor: [17, 34] });
      const popup = `<strong>${bs.name}</strong><br><small>${bs.address}</small>`;
      const marker = L.marker([bs.latitude, bs.longitude], { icon })
        .addTo(this.map)
        .bindPopup(popup);
      marker.on('click', () => { this.zone.run(() => this.selectBarbershop(bs.id)); });
      this.markers.set(bs.id, marker);
    }
  }

  // ── Seleccionar barbería (mapa ↔ lista) ──────────────────────────────
  selectBarbershop(id: string): void {
    this.selectedId = id;
    const el = document.getElementById('bs-item-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.markers.get(id)?.openPopup();
  }

  goToBarbershop(id: string): void {
    this.router.navigate(['/barbershop', id]);
  }

  // ── Pedir ubicación ──────────────────────────────────────────────────
  async requestLocation(): Promise<void> {
    const loc = await this.geo.getCurrentLocation(true);
    if (loc) {
      this.userLocation = loc;
      this.hasLocation  = true;
      this.buildDisplayList();
      this.drawUserLayer();
      if (this.map) this.map.setView([loc.latitude, loc.longitude], 13);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  formatDist(d: number | null): string {
    if (!d && d !== 0) return '';
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  }

  getImage(bs: any): string {
    const imgs: any[] = bs.images ?? [];
    return imgs.find((i: any) => i.image?.type === 'PORTADA')?.image?.url
      || imgs.find((i: any) => i.image?.type === 'ICONO')?.image?.url
      || bs.logoImage || '';
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371, dLat = this.rad(lat2 - lat1), dLng = this.rad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(this.rad(lat1)) * Math.cos(this.rad(lat2)) * Math.sin(dLng/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 100) / 100;
  }
  private rad(d: number): number { return d * Math.PI / 180; }
}
