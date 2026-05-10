import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../../../core/client-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BarbershopResolverService } from '../../../../core/barbershop-resolver.service';
import { GeolocationService, Location } from '../../../../core/geolocation.service';
import { NearbyBarbershopsService } from '../../../../core/nearby-barbershops.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  appName = environment.appName;
  apiUrl = environment.apiUrl;
  bsId = environment.barbershopId;

  // Context detection
  hasSubdomain = false;
  isBarber = false;
  isAdmin = false;
  showAdminPanel = false;
  currentUser: any = null;

  // Barbershop data
  barbershop: any = null;
  services: any[] = [];
  barbers: any[] = [];
  amenities: any[] = [];
  reviews: any[] = [];
  offers: any[] = [];

  // Client home (sin subdominio)
  nextBooking: any = null;
  nearbyBarbershops: any[] = [];
  hasUserLocation = false;
  searchQuery = '';
  searchResults: any[] = [];
  isSearching = false;
  userLocation: Location | null = null;

  // Debounce del buscador
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Filtros y ordenamiento
  activeFilter: 'all' | 'nearby' | 'top-rated' | 'popular' = 'all';
  sortBy: 'distance' | 'rating' | 'popularity' = 'distance';
  locationLoading = false;

  // Picker de servicios
  showServicePicker = false;
  servicesLoading = false;
  globalServices: any[] = [];
  selectedServiceFilter = '';

  readonly filterChips = [
    { id: 'all',       label: 'Todos',           icon: 'apps-outline' },
    { id: 'nearby',    label: 'Cerca de mí',     icon: 'location-outline' },
    { id: 'top-rated', label: 'Mejor calificados', icon: 'star-outline' },
    { id: 'popular',   label: 'Populares',       icon: 'flame-outline' },
  ];

  // Barber agenda
  agendaDate: Date = new Date();
  agendaSlots: any[] = [];
  barberProfile: any = null;

  // Admin agenda
  selectedBarberForAgenda: any = null;
  barberAgendaSlots: any[] = [];
  showBarberAgenda: any = {};

  // Loading & Error
  loading = true;
  error = false;
  barbershopNotFound = false;
  redirectCountdown = 5;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  hasSchedules = true;

  // Admin panel & schedule editor
  allGlobalServices: any[] = [];
  allGlobalAmenities: any[] = [];
  private offerDraft: any = {};

  // Schedule editor
  scheduleBarber: any = null;
  scheduleData: { day: string; label: string; enabled: boolean; openTime: string; closeTime: string }[] = [];
  showScheduleEditor = false;

  // Image viewer
  viewerImages: string[] = [];
  viewerIndex = 0;
  viewerSlideDir: 'left' | 'right' | null = null;
  private touchStartX = 0;
  get viewerUrl(): string | null {
    return this.viewerImages.length ? this.viewerImages[this.viewerIndex] : null;
  }

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private http: HttpClient,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private resolverService: BarbershopResolverService,
    private geolocationService: GeolocationService,
    private nearbyService: NearbyBarbershopsService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.hasSubdomain = this.resolverService.hasSubdomain;
    this.currentUser = this.auth.currentUser;

    if (!this.hasSubdomain) {
      // Modo: cliente sin subdominio
      this.loadClientHome();
    } else {
      // Modo: con subdominio (barbería específica)
      this.loadBarbershopData();
      if (this.auth.isAuthenticated) {
        // Detectar rol del usuario desde su perfil
        this.checkUserRoles();
      }
    }
  }

  /**
   * Detecta el rol del usuario: admin o barbero de la barbería actual
   */
  private checkUserRoles(): void {
    if (!this.bsId) return;

    // Siempre hacer las llamadas API para detectar admin/barbero en esta barbería específica
    // Los roles del token solo indican si el usuario es admin en general, pero no si es admin de ESTA barbería
    this.checkAdmin();
    this.checkBarber();
  }

  ionViewWillEnter(): void {
    // Refrescar estado de auth en cada visita
    this.currentUser = this.auth.currentUser;
    this.hasSubdomain = this.resolverService.hasSubdomain;

    if (this.hasSubdomain) {
      this.loadBarbershopData();
    } else {
      if (this.auth.isAuthenticated) {
        this.loadNextBooking();
      }
      this.loadNearbyBarbershops();
    }
  }

  // ==================== CLIENT HOME (SIN SUBDOMINIO) ====================

  loadClientHome(): void {
    this.loading = true;
    this.error = false;

    if (this.auth.isAuthenticated) {
      this.loadNextBooking();
    }
    this.loadNearbyBarbershops();
    this.loading = false;
  }

  loadNextBooking(): void {
    this.api.getMyBookings().subscribe({
      next: (res: any) => {
        const bookings = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const upcoming = bookings
          .filter((b: any) => {
            const bookDate = new Date(b.date ?? b.bookingDate);
            return bookDate >= new Date() && ['PENDIENTE', 'CONFIRMADA'].includes(b.status);
          })
          .sort((a: any, b: any) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
        this.nextBooking = upcoming[0] || null;
      },
      error: () => { this.nextBooking = null; },
    });
  }

  loadNearbyBarbershops(): void {
    const location = this.geolocationService.getStoredLocation();
    if (!location) {
      this.hasUserLocation = false;
      // Cargar todas de todas formas para mostrar la lista
      this.nearbyService.search('').subscribe({
        next: (data) => { this.nearbyBarbershops = data || []; },
        error: () => { this.nearbyBarbershops = []; },
      });
      return;
    }

    this.userLocation = location;
    this.hasUserLocation = true;
    this.nearbyService.findNearby(location.latitude, location.longitude, 20).subscribe({
      next: (data) => { this.nearbyBarbershops = this.enrichWithDistance(data || []); },
      error: () => { this.nearbyBarbershops = []; },
    });
  }

  async requestLocation(): Promise<void> {
    this.locationLoading = true;
    try {
      const loc = await this.geolocationService.getCurrentLocation();
      if (loc) {
        this.userLocation = loc;
        this.hasUserLocation = true;
        this.nearbyService.findNearby(loc.latitude, loc.longitude, 20).subscribe({
          next: (data) => { this.nearbyBarbershops = this.enrichWithDistance(data || []); this.locationLoading = false; },
          error: () => { this.locationLoading = false; },
        });
      } else {
        this.locationLoading = false;
      }
    } catch {
      this.locationLoading = false;
    }
  }

  toggleServicePicker(): void {
    this.showServicePicker = !this.showServicePicker;
    if (this.showServicePicker && this.globalServices.length === 0) {
      this.servicesLoading = true;
      this.http.get<any>(`${this.apiUrl}/services`).subscribe({
        next: (res: any) => {
          this.globalServices = (res.data ?? res ?? []).filter((s: any) => s.isActive !== false);
          this.servicesLoading = false;
        },
        error: () => { this.servicesLoading = false; },
      });
    }
  }

  filterByService(svc: any): void {
    if (this.selectedServiceFilter === svc.name) {
      this.selectedServiceFilter = '';
      this.clearSearch();
    } else {
      this.selectedServiceFilter = svc.name;
      this.searchQuery = svc.name;          // ← actualizar searchQuery para el mensaje de vacío
      this.searchBarbershops(svc.name, 'name');
    }
    this.showServicePicker = false;
  }

  setFilter(filter: 'all' | 'nearby' | 'top-rated' | 'popular'): void {
    this.activeFilter = filter;
    if (filter === 'nearby' && !this.hasUserLocation) {
      this.requestLocation();
    }
  }

  get displayedBarbershops(): any[] {
    let list = this.isSearching ? this.searchResults : [...this.nearbyBarbershops];

    switch (this.activeFilter) {
      case 'nearby':    list = list.filter(b => b.distance != null).sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99)); break;
      case 'top-rated': list = [...list].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)); break;
      case 'popular':   list = [...list].sort((a, b) => (b.totalReviews ?? 0) - (a.totalReviews ?? 0)); break;
      default:          list = this.hasUserLocation ? list.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99)) : list; break;
    }
    return list;
  }

  getOccupancyLabel(bs: any): string {
    const reviews = bs.totalReviews ?? 0;
    if (reviews > 50) return '🔥 Muy popular';
    if (reviews > 20) return '⚡ Popular';
    return '';
  }

  calcDuration(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  getBarbershopCover(bs: any): string {
    const images: any[] = bs.images ?? [];
    const portada = images.find((i: any) => i.image?.type === 'PORTADA')?.image?.url;
    const icono   = images.find((i: any) => i.image?.type === 'ICONO')?.image?.url;
    return portada || icono || bs.coverImage || bs.logoImage || '';
  }

  getBarbershopLogo(bs: any): string | null {
    const images: any[] = bs.images ?? [];
    const icono = images.find((i: any) => i.image?.type === 'ICONO')?.image?.url;
    return icono || bs.logoImage || null;
  }

  private enrichWithDistance(barbershops: any[]): any[] {
    if (!this.userLocation) return barbershops;
    return barbershops.map(b => ({
      ...b,
      distance: b.distance || this.calculateDistance(
        this.userLocation!.latitude, this.userLocation!.longitude,
        b.latitude, b.longitude
      ),
    }));
  }

  async searchBarbershops(query: string, searchType: 'city' | 'name' = 'name'): Promise<void> {
    if (!query.trim()) {
      this.searchResults = [];
      this.isSearching = false;
      return;
    }

    const loader = await this.loadingCtrl.create({ message: 'Buscando...' });
    await loader.present();

    const observable = searchType === 'city' ? this.nearbyService.searchByCity(query) : this.nearbyService.search(query);

    observable.subscribe({
      next: (data) => {
        this.searchResults = this.enrichWithDistance(data);
        this.isSearching = true;
        loader.dismiss();
      },
      error: () => {
        this.toast('Error al buscar');
        loader.dismiss();
      },
    });
  }

  onSearchInput(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (!this.searchQuery.trim()) {
      this.clearSearch();
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.searchBarbershops(this.searchQuery, 'name');
    }, 400);
  }

  clearSearch(): void {
    if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
    this.searchQuery = '';
    this.searchResults = [];
    this.isSearching = false;
    this.selectedServiceFilter = '';
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  formatDistance(distance: number): string {
    if (!distance) return '';
    if (distance < 1) return `${Math.round(distance * 1000)} m`;
    return `${distance} km`;
  }

  goToBarbershop(barbershopId: string): void {
    this.router.navigate(['/barbershop', barbershopId]);
  }

  // ==================== BARBERSHOP DATA (CON SUBDOMINIO) ====================

  /**
   * Método genérico que redirige a loadBarbershopData (para compatibilidad con código admin existente)
   */
  ngOnDestroy(): void {
    this.stopCountdown();
  }

  loadData(): void {
    this.loadBarbershopData();
  }

  loadBarbershopData(): void {
    this.loading = true;
    this.error = false;

    // Barbería no encontrada por el resolver (slug inválido o inactiva)
    if (this.resolverService.notFound) {
      this.loading = false;
      this.barbershopNotFound = true;
      this.startRedirectCountdown();
      return;
    }

    // Usar datos del resolver si ya están cargados
    if (this.resolverService.barbershop) {
      this.barbershop = this.resolverService.barbershop;
      this.services = this.barbershop.services ?? [];
      this.barbers = (this.barbershop.barbers ?? []).filter((b: any) => b.isActive);
      this.amenities = this.barbershop.amenities ?? [];
      this.reviews = this.barbershop.reviews ?? [];
      this.offers = (this.barbershop.offers ?? []).filter((o: any) => o.isActive);
      this.loading = false;
      return;
    }

    // Si no están cargados, llamar a la API
    this.api.getBarbershop().subscribe({
      next: (res: any) => {
        const data = res.data ?? res;
        this.barbershop = data;
        this.services = data.services ?? [];
        this.barbers = (data.barbers ?? []).filter((b: any) => b.isActive);
        this.amenities = data.amenities ?? [];
        this.reviews = data.reviews ?? [];
        this.offers = (data.offers ?? []).filter((o: any) => o.isActive);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.barbershopNotFound = true;
        this.startRedirectCountdown();
      },
    });
  }

  private startRedirectCountdown(): void {
    this.redirectCountdown = 10;
    this.countdownInterval = setInterval(() => {
      this.redirectCountdown--;
      if (this.redirectCountdown <= 0) {
        this.stopCountdown();
        this.redirectToMain();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  redirectToMain(): void {
    const base = environment.baseDomains.find(d => window.location.hostname.endsWith(d)) || 'localhost';
    const port = window.location.port ? `:${window.location.port}` : '';
    window.location.href = `${window.location.protocol}//${base}${port}/tabs/home`;
  }

  doRefresh(event: any): void {
    if (this.hasSubdomain) {
      this.loadBarbershopData();
      if (this.isAdmin) {
        this.checkAdmin();
      }
      if (this.isBarber) {
        this.loadAgenda();
      }
    } else {
      if (this.auth.isAuthenticated) {
        this.loadNextBooking();
      }
      this.loadNearbyBarbershops();
    }
    setTimeout(() => event.target.complete(), 500);
  }

  // ==================== BARBERSHOP ROLE DETECTION ====================

  checkAdmin(): void {
    if (!this.auth.isAuthenticated || !this.bsId) {
      this.isAdmin = false;
      return;
    }
    this.http.get<any>(`${this.apiUrl}/barbershops/admin/my-barbershops`).subscribe({
      next: (res: any) => {
        const myBs = Array.isArray(res.data) ? res.data : [];
        this.isAdmin = myBs.some((bs: any) => bs.id === this.bsId);
        if (this.isAdmin) this.checkSchedules();
      },
      error: () => { this.isAdmin = false; },
    });
  }

  private checkSchedules(): void {
    const firstBarber = this.barbershop?.barbers?.[0];
    if (!firstBarber) { this.hasSchedules = false; return; }
    this.http.get<any>(`${this.apiUrl}/schedules/barber/${firstBarber.id}`).subscribe({
      next: (res: any) => { this.hasSchedules = (res.data || []).length > 0; },
      error: () => { this.hasSchedules = false; },
    });
  }

  checkBarber(): void {
    this.api.getMyBarberProfile().subscribe({
      next: (res: any) => {
        const profiles = Array.isArray(res.data) ? res.data : [];
        this.isBarber = profiles.some((p: any) => p.barbershopId === this.bsId);
        if (this.isBarber) {
          this.barberProfile = profiles.find((p: any) => p.barbershopId === this.bsId);
          this.loadAgenda();
        }
      },
      error: () => { this.isBarber = false; },
    });
  }

  // ==================== BARBER AGENDA ====================

  loadAgenda(date?: Date): void {
    const targetDate = date || this.agendaDate;
    const dateStr = targetDate.toISOString().split('T')[0];

    this.api.getMyAgenda(dateStr).subscribe({
      next: (res: any) => {
        this.agendaSlots = res.data || [];
      },
      error: () => { this.agendaSlots = []; },
    });
  }

  prevAgendaDate(): void {
    this.agendaDate.setDate(this.agendaDate.getDate() - 1);
    this.agendaDate = new Date(this.agendaDate);
    this.loadAgenda();
  }

  nextAgendaDate(): void {
    this.agendaDate.setDate(this.agendaDate.getDate() + 1);
    this.agendaDate = new Date(this.agendaDate);
    this.loadAgenda();
  }

  formatAgendaDate(): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateStr = this.agendaDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Hoy';
    if (dateStr === tomorrowStr) return 'Mañana';
    return this.agendaDate.toLocaleDateString('es-ES', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  // ==================== ADMIN AGENDA ====================

  toggleBarberAgenda(barber: any): void {
    const barberId = barber.id;
    if (this.showBarberAgenda[barberId]) {
      delete this.showBarberAgenda[barberId];
    } else {
      this.loadBarberAgenda(barber);
      this.showBarberAgenda[barberId] = true;
    }
  }

  loadBarberAgenda(barber: any): void {
    const dateStr = new Date().toISOString().split('T')[0];
    const params = new HttpParams().set('barberId', barber.id).set('date', dateStr);

    this.http.get<any>(`${this.apiUrl}/bookings`, { params }).subscribe({
      next: (res: any) => {
        const bookings = Array.isArray(res.data) ? res.data : res.data?.data || [];
        this.barberAgendaSlots = bookings.filter((b: any) => b.barberId === barber.id);
      },
      error: () => { this.barberAgendaSlots = []; },
    });
  }

  toggleAdminPanel(): void {
    this.showAdminPanel = !this.showAdminPanel;
  }

  goToBooking(): void {
    const bsId = this.bsId || this.resolverService.barbershop?.id;
    if (bsId) {
      this.router.navigate(['/booking'], { queryParams: { barbershopId: bsId } });
    } else {
      this.router.navigateByUrl('/booking');
    }
  }

  getStarArray(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  }

  get avgRating(): number {
    if (!this.reviews.length) return 0;
    const sum = this.reviews.reduce((s: number, r: any) => s + r.rating, 0);
    return Math.round((sum / this.reviews.length) * 10) / 10;
  }

  formatPrice(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }

  // ==================== ADMIN ACTIONS ====================

  handleAlertAction(action: string): void {
    switch (action) {
      case 'add-service':      this.addService();      break;
      case 'add-barber':       this.addBarber();       break;
      case 'manage-schedules': this.manageSchedules(); break;
    }
  }

  async addBarber(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo Barbero',
      message: 'Email de un usuario registrado',
      inputs: [
        { name: 'email', type: 'email', placeholder: 'Email del usuario' },
        { name: 'bio', type: 'textarea', placeholder: 'Bio (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Agregar',
          handler: (data) => {
            if (!data.email) { this.toast('El email es obligatorio', 'warning'); return false; }
            this.http.post<any>(`${this.apiUrl}/barbers`, {
              barbershopId: this.bsId, email: data.email, bio: data.bio || undefined,
            }).subscribe({
              next: () => { this.toast('Barbero agregado', 'success'); this.loadData(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async addService(): Promise<void> {
    // Load global services catalog
    this.http.get<any>(`${this.apiUrl}/services`).subscribe({
      next: async (res: any) => {
        this.allGlobalServices = res.data || [];
        const existingIds = this.services.map((s: any) => s.service?.id || s.serviceId);
        const available = this.allGlobalServices.filter((s: any) => !existingIds.includes(s.id));

        const inputs = available.map((s: any) => ({
          type: 'radio' as const, label: `${s.name} (${s.category || ''})`, value: s.id,
        }));

        const alert = await this.alertCtrl.create({
          header: 'Agregar Servicio',
          inputs,
          buttons: [
            { text: 'Cancelar', role: 'cancel' },
            { text: 'Crear nuevo', handler: () => { this.createNewService(); } },
            {
              text: 'Siguiente',
              handler: (serviceId: string) => {
                if (!serviceId) { this.toast('Selecciona uno', 'warning'); return false; }
                const svc = available.find((s: any) => s.id === serviceId);
                this.setServicePrice(serviceId, svc?.name || '');
                return true;
              },
            },
          ],
        });
        await alert.present();
      },
    });
  }

  async createNewService(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo Servicio',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre' },
        { name: 'description', type: 'textarea', placeholder: 'Descripcion (opcional)' },
        { name: 'category', type: 'text', placeholder: 'Categoria' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Crear',
          handler: (data) => {
            if (!data.name) return false;
            this.http.post<any>(`${this.apiUrl}/services`, data).subscribe({
              next: (res: any) => { this.setServicePrice(res.data.id, data.name); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async setServicePrice(serviceId: string, name: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: `Precio - ${name}`,
      inputs: [
        { name: 'price', type: 'number', placeholder: 'Precio ($)' },
        { name: 'durationMin', type: 'number', placeholder: 'Duracion (min)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            if (!data.price || !data.durationMin) return false;
            this.http.post<any>(`${this.apiUrl}/services/barbershop`, {
              barbershopId: this.bsId, serviceId,
              price: parseFloat(data.price), durationMin: parseInt(data.durationMin, 10),
            }).subscribe({
              next: () => { this.toast('Servicio agregado', 'success'); this.loadData(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  // ==================== SCHEDULE EDITOR ====================

  readonly DAYS = [
    { key: 'LUNES', label: 'Lunes' },
    { key: 'MARTES', label: 'Martes' },
    { key: 'MIERCOLES', label: 'Miercoles' },
    { key: 'JUEVES', label: 'Jueves' },
    { key: 'VIERNES', label: 'Viernes' },
    { key: 'SABADO', label: 'Sabado' },
    { key: 'DOMINGO', label: 'Domingo' },
  ];

  async manageSchedules(): Promise<void> {
    if (!this.barbers.length) { this.toast('Primero agrega un barbero', 'warning'); return; }
    const buttons = this.barbers.map((b: any) => ({
      text: `${b.firstName} ${b.lastName}`,
      handler: () => { this.openScheduleEditor(b); },
    }));
    buttons.push({ text: 'Cancelar', handler: () => {} });
    const alert = await this.alertCtrl.create({ header: 'Horarios', message: 'Selecciona barbero', buttons });
    await alert.present();
  }

  openScheduleEditor(barber: any): void {
    this.scheduleBarber = barber;
    this.http.get<any>(`${this.apiUrl}/schedules/barber/${barber.id}`).subscribe({
      next: (res: any) => {
        const existing = res.data || [];
        this.scheduleData = this.DAYS.map(d => {
          const found = existing.find((s: any) => s.dayOfWeek === d.key);
          return {
            day: d.key, label: d.label,
            enabled: !!found,
            openTime: found?.openTime || '09:00',
            closeTime: found?.closeTime || '19:00',
          };
        });
        this.showScheduleEditor = true;
      },
      error: () => {
        this.scheduleData = this.DAYS.map(d => ({ day: d.key, label: d.label, enabled: false, openTime: '09:00', closeTime: '19:00' }));
        this.showScheduleEditor = true;
      },
    });
  }

  applyToAllDays(): void {
    const first = this.scheduleData.find(d => d.enabled);
    const open = first?.openTime || '09:00';
    const close = first?.closeTime || '19:00';
    this.scheduleData.forEach(d => { d.enabled = true; d.openTime = open; d.closeTime = close; });
    this.toast('Horario aplicado a todos los dias', 'medium');
  }

  applyToWeekdays(): void {
    const weekdays = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
    const first = this.scheduleData.find(d => d.enabled);
    const open = first?.openTime || '09:00';
    const close = first?.closeTime || '19:00';
    this.scheduleData.forEach(d => { if (weekdays.includes(d.day)) { d.enabled = true; d.openTime = open; d.closeTime = close; } });
    this.toast('Horario aplicado L-V', 'medium');
  }

  saveSchedules(): void {
    if (!this.scheduleBarber) return;
    const enabled = this.scheduleData.filter(d => d.enabled);
    if (!enabled.length) { this.toast('Selecciona al menos un dia', 'warning'); return; }

    const groups = new Map<string, string[]>();
    for (const d of enabled) {
      const key = `${d.openTime}-${d.closeTime}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d.day);
    }

    let done = 0;
    const total = groups.size;
    groups.forEach((days, key) => {
      const [openTime, closeTime] = key.split('-');
      this.http.post<any>(`${this.apiUrl}/schedules`, {
        barberId: this.scheduleBarber.id, daysOfWeek: days,
        openTime, closeTime, slotDurationMinutes: 30,
      }).subscribe({
        next: () => { done++; if (done === total) { this.toast('Horarios guardados', 'success'); this.showScheduleEditor = false; this.loadData(); } },
        error: () => { done++; if (done === total) this.toast('Error en algunos horarios', 'danger'); },
      });
    });
  }

  closeScheduleEditor(): void {
    this.showScheduleEditor = false;
    this.scheduleBarber = null;
  }

  // Offer creation: multi-step
  async manageOffers(): Promise<void> {
    this.offerDraft = {};
    const alert = await this.alertCtrl.create({
      header: 'Nueva Oferta - Paso 1/3',
      message: 'Datos basicos',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre de la oferta' },
        { name: 'description', type: 'textarea', placeholder: 'Descripcion (opcional)' },
        { name: 'discountValue', type: 'number', placeholder: 'Valor del descuento' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Siguiente',
          handler: (data) => {
            if (!data.name || !data.discountValue) { this.toast('Nombre y descuento obligatorios'); return false; }
            this.offerDraft = { ...data, discountValue: parseFloat(data.discountValue) };
            this.offerStep2Dates();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async offerStep2Dates(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextStr = nextMonth.toISOString().split('T')[0];

    const alert = await this.alertCtrl.create({
      header: 'Oferta - Paso 2/3',
      message: 'Fechas y tipo de descuento',
      inputs: [
        { name: 'validFrom', type: 'date', label: 'Desde', value: today },
        { name: 'validUntil', type: 'date', label: 'Hasta', value: nextStr },
        { name: 'startTime', type: 'time', label: 'Hora inicio (opcional)' },
        { name: 'endTime', type: 'time', label: 'Hora fin (opcional)' },
      ],
      buttons: [
        { text: 'Atras', role: 'cancel' },
        {
          text: 'Siguiente',
          handler: (data) => {
            if (!data.validFrom || !data.validUntil) { this.toast('Fechas obligatorias'); return false; }
            this.offerDraft.validFrom = new Date(data.validFrom).toISOString();
            this.offerDraft.validUntil = new Date(data.validUntil).toISOString();
            this.offerDraft.startTime = data.startTime || undefined;
            this.offerDraft.endTime = data.endTime || undefined;
            this.offerStep3Scope();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async offerStep3Scope(): Promise<void> {
    // Build checkboxes for services and barbers
    const serviceInputs = this.services.map((s: any) => ({
      type: 'checkbox' as const,
      label: `${(s as any).service?.name || s.name}`,
      value: `svc:${(s as any).service?.id || s.serviceId}`,
      checked: true,
    }));
    const barberInputs = this.barbers.map((b: any) => ({
      type: 'checkbox' as const,
      label: `${b.firstName} ${b.lastName}`,
      value: `bar:${b.id}`,
      checked: true,
    }));

    const allInputs = [
      ...serviceInputs,
      ...barberInputs,
    ];

    const alert = await this.alertCtrl.create({
      header: 'Oferta - Paso 3/3',
      message: 'Selecciona servicios y barberos. Si dejas todos marcados aplica a todos.',
      inputs: allInputs,
      buttons: [
        { text: 'Atras', role: 'cancel' },
        {
          text: 'Crear Oferta',
          handler: (selected: string[]) => {
            const serviceIds = selected.filter(v => v.startsWith('svc:')).map(v => v.replace('svc:', ''));
            const barberIds = selected.filter(v => v.startsWith('bar:')).map(v => v.replace('bar:', ''));
            const allServices = serviceIds.length === this.services.length;
            const allBarbers = barberIds.length === this.barbers.length;
            const appliesToAll = allServices && allBarbers;

            this.http.post<any>(`${this.apiUrl}/offers`, {
              barbershopId: this.bsId,
              name: this.offerDraft.name,
              description: this.offerDraft.description || undefined,
              discountType: 'PORCENTAJE',
              discountValue: this.offerDraft.discountValue,
              validFrom: this.offerDraft.validFrom,
              validUntil: this.offerDraft.validUntil,
              startTime: this.offerDraft.startTime,
              endTime: this.offerDraft.endTime,
              serviceIds: appliesToAll ? [] : serviceIds,
              barberIds: appliesToAll ? [] : barberIds,
              appliesToAll,
            }).subscribe({
              next: () => { this.toast('Oferta creada', 'success'); this.loadData(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async manageAmenities(): Promise<void> {
    this.http.get<any>(`${this.apiUrl}/amenities`).subscribe({
      next: async (res: any) => {
        const all = res.data || [];
        const currentIds = this.amenities.map((a: any) => a.amenityId || a.amenity?.id);
        const inputs = all.map((a: any) => ({
          type: 'checkbox' as const, label: a.name, value: a.id, checked: currentIds.includes(a.id),
        }));
        const alert = await this.alertCtrl.create({
          header: 'Caracteristicas',
          inputs,
          buttons: [
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Guardar',
              handler: (selected: string[]) => {
                const toToggle = [
                  ...selected.filter(id => !currentIds.includes(id)),
                  ...currentIds.filter((id: string) => !selected.includes(id)),
                ];
                let done = 0;
                if (!toToggle.length) return;
                for (const amenityId of toToggle) {
                  this.http.post<any>(`${this.apiUrl}/amenities/toggle`, { barbershopId: this.bsId, amenityId }).subscribe({
                    next: () => { done++; if (done === toToggle.length) { this.toast('Actualizado', 'success'); this.loadData(); } },
                    error: () => { done++; },
                  });
                }
              },
            },
          ],
        });
        await alert.present();
      },
    });
  }

  async editBarbershopInfo(field: string): Promise<void> {
    const titles: Record<string, string> = {
      coverImage: 'Foto de portada', logoImage: 'Icono / Logo', description: 'Descripcion',
      phone: 'Telefono', depositAmount: 'Monto de sena', cancellationHours: 'Horas de cancelacion',
    };
    const current = this.barbershop?.[field] || '';
    const inputType = ['depositAmount', 'cancellationHours'].includes(field) ? 'number' : field === 'description' ? 'textarea' : 'text';

    const alert = await this.alertCtrl.create({
      header: titles[field] || field,
      inputs: [{ name: 'value', type: inputType as any, value: current, placeholder: titles[field] }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            let val: any = data.value;
            if (field === 'depositAmount') val = parseFloat(val) || 0;
            if (field === 'cancellationHours') val = parseInt(val, 10) || 12;
            this.http.put<any>(`${this.apiUrl}/barbershops/${this.bsId}`, { [field]: val }).subscribe({
              next: () => { this.toast('Actualizado', 'success'); this.loadData(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  // ==================== DELETE ACTIONS ====================

  async deleteBarber(barberId: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar barbero',
      message: 'Estas seguro? Se desactivara este barbero.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.http.delete<any>(`${this.apiUrl}/barbers/${barberId}`).subscribe({
              next: () => { this.toast('Barbero eliminado', 'success'); this.loadData(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteService(barbershopServiceId: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar servicio',
      message: 'Estas seguro? Se quitara este servicio de tu barberia.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.http.delete<any>(`${this.apiUrl}/services/barbershop/${barbershopServiceId}`).subscribe({
              next: () => { this.toast('Servicio eliminado', 'success'); this.loadData(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteOffer(offerId: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar oferta',
      message: 'Estas seguro? Se desactivara esta oferta.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.http.delete<any>(`${this.apiUrl}/offers/${offerId}`).subscribe({
              next: () => { this.toast('Oferta eliminada', 'success'); this.loadData(); },
              error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async toast(message: string, color = 'warning'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }

  // ── Image helpers ──────────────────────────────────────────
  getBarbershopImage(type: string): string | null {
    return this.barbershop?.images?.find((i: any) => i.image?.type === type)?.image?.url ?? null;
  }

  getBarberPerfil(barber: any): string | null {
    return barber.images?.find((i: any) => i.image?.type === 'PERFIL')?.image?.url ?? null;
  }

  getBarbershopGallery(): string[] {
    return (this.barbershop?.images ?? [])
      .filter((i: any) => i.image?.type === 'GALERIA')
      .map((i: any) => i.image.url);
  }

  // ── Location ───────────────────────────────────────────────
  getMapUrl(): SafeResourceUrl {
    const lat = this.barbershop?.latitude;
    const lng = this.barbershop?.longitude;
    const d = 0.008;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  openDirections(): void {
    const lat = this.barbershop?.latitude;
    const lng = this.barbershop?.longitude;
    const dest = lat && lng ? `${lat},${lng}` : encodeURIComponent(this.barbershop?.address ?? '');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  }

  // ── Image viewer ───────────────────────────────────────────
  openViewer(images: string | string[], index = 0): void {
    this.viewerImages   = Array.isArray(images) ? images : [images];
    this.viewerIndex    = index;
    this.viewerSlideDir = null;
  }

  closeViewer(): void { this.viewerImages = []; }

  viewerPrev(): void {
    if (this.viewerIndex === 0) return;
    this.viewerSlideDir = 'right';
    setTimeout(() => { this.viewerIndex--; this.viewerSlideDir = null; }, 10);
  }

  viewerNext(): void {
    if (this.viewerIndex === this.viewerImages.length - 1) return;
    this.viewerSlideDir = 'left';
    setTimeout(() => { this.viewerIndex++; this.viewerSlideDir = null; }, 10);
  }

  onViewerTouchStart(e: TouchEvent): void { this.touchStartX = e.touches[0].clientX; }
  onViewerTouchEnd(e: TouchEvent): void {
    const delta = e.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(delta) < 50) return;
    delta < 0 ? this.viewerNext() : this.viewerPrev();
  }
}
