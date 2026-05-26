import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AlertController, ToastController } from '@ionic/angular';
import { BarbershopsService } from '../../services/barbershops.service';
import { BarbersService } from '../../services/barbers.service';
import { ServicesService } from '../../services/services.service';
import { SchedulesService } from '../../services/schedules.service';
import { AmenitiesService } from '../../services/amenities.service';
import { UploadService, UploadEvent } from '../../services/upload.service';
import { GeocodingService } from '../../core/geocoding.service';
import { AuthService } from '../../core/services/auth.service';
import { Barbershop, BarbershopAdmin, Amenity, ImageType, Barber } from '../models';
import { environment } from '../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-barbershop-profile',
  templateUrl: './barbershop-profile.component.html',
  styleUrls: ['./barbershop-profile.component.scss'],
})
export class AppBarbershopProfileComponent implements OnChanges {
  @Input() barbershopId!: string;
  @Input() embedded = false; // true → usa div scrollable en vez de ion-content propio

  barbershop: Barbershop | null = null;
  isLoading = true;
  error: string | null = null;

  isAdmin = false;
  isSuperAdmin = false;
  showAdminPanel = false;
  hasSchedules = true;
  allAmenities: Amenity[] = [];
  barbershopAmenityIds: string[] = [];

  showPlanManager = false;
  planStatus: any = null;
  planLoading = false;
  showImageManager = false;
  showBankAccount = false;
  uploadingFor: string | null = null;
  uploadStatus: 'idle' | 'compressing' | 'uploading' = 'idle';
  uploadProgress = 0;

  viewerImages: string[] = [];
  viewerIndex = 0;
  viewerSlideDir: 'left' | 'right' | null = null;
  private touchStartX = 0;

  get viewerUrl(): string | null {
    return this.viewerImages.length ? this.viewerImages[this.viewerIndex] : null;
  }

  openViewer(images: string | string[], index = 0): void {
    this.viewerImages = Array.isArray(images) ? images : [images];
    this.viewerIndex  = index;
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

  onViewerTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
  }

  onViewerTouchEnd(e: TouchEvent): void {
    const delta = e.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(delta) < 50) return;
    delta < 0 ? this.viewerNext() : this.viewerPrev();
  }

  adminMenuItems = [
    { icon: 'person-add-outline',  label: 'Agregar Barbero',   action: 'add-barber' },
    { icon: 'cut-outline',         label: 'Agregar Servicio',  action: 'add-service' },
    { icon: 'link-outline',        label: 'Asignar Servicios', action: 'assign-services' },
    { icon: 'time-outline',        label: 'Gestionar Horarios',action: 'manage-schedules' },
    { icon: 'card-outline',        label: 'Plan',              action: 'manage-plan' },
    { icon: 'location-outline',    label: 'Ubicacion',         action: 'edit-location' },
    { icon: 'images-outline',      label: 'Imagenes',          action: 'manage-images' },
    { icon: 'pricetag-outline',    label: 'Ofertas',           action: 'manage-offers' },
    { icon: 'leaf-outline',        label: 'Caracteristicas',   action: 'manage-amenities' },
    { icon: 'settings-outline',    label: 'Configuracion',     action: 'edit-settings' },
    { icon: 'stats-chart-outline', label: 'Estadisticas',      action: 'stats' },
    { icon: 'wallet-outline',      label: 'Pagos y deudas',    action: 'payments' },
    { icon: 'cash-outline',        label: 'Cuenta de cobro',   action: 'manage-bank-account' },
  ];

  constructor(
    private router: Router,
    private barbershopsService: BarbershopsService,
    private barbersService: BarbersService,
    private servicesService: ServicesService,
    private schedulesService: SchedulesService,
    private amenitiesService: AmenitiesService,
    private authService: AuthService,
    private http: HttpClient,
    private alertController: AlertController,
    private toastController: ToastController,
    private uploadService: UploadService,
    private geocodingService: GeocodingService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['barbershopId'] && this.barbershopId) {
      this.loadBarbershop(this.barbershopId);
    }
  }

  loadBarbershop(id: string): void {
    this.isLoading = true;
    this.error = null;
    this.barbershopsService.getOne(id).subscribe({
      next: (res) => {
        this.barbershop = res.data;
        this.checkAdminAccess();
        this.isLoading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la informacion de la barberia.';
        this.isLoading = false;
      },
    });
  }

  checkAdminAccess(): void {
    if (!this.authService.isAuthenticated) return;

    if (this.authService.hasRole('ADMIN_GENERAL')) {
      this.isAdmin = true;
      this.isSuperAdmin = true;
      this.checkSetupAlerts();
      return;
    }

    const currentUserId = this.authService.currentUser?.id;
    if (!currentUserId) return;

    const admins: BarbershopAdmin[] = this.barbershop?.admins ?? [];
    this.isAdmin = admins.some((a) => a.userId === currentUserId);
    if (this.isAdmin) this.checkSetupAlerts();
  }

  checkSetupAlerts(): void {
    const barbers = this.barbershop?.barbers || [];
    if (!barbers.length) return;
    this.schedulesService.getByBarber(barbers[0].id).subscribe({
      next: (res: any) => { this.hasSchedules = (res.data || []).length > 0; },
      error: () => { this.hasSchedules = false; },
    });
  }

  navigateToBooking(): void {
    if (this.barbershop) {
      this.router.navigate(['/booking'], {
        queryParams: { barbershopId: this.barbershop.id },
      });
    }
  }

  getStarArray(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  }

  formatPrice(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }

  // ==================== ADMIN ACTIONS ====================

  get currentSlug(): string {
    const slug = this.barbershop?.slug ?? '';
    return slug.startsWith('disabled-') ? '' : slug;
  }

  get subdomainUrl(): string {
    if (!this.currentSlug) return '';
    const base = (environment as any).baseDomains?.[0] ?? 'turnera.es';
    return `https://${this.currentSlug}.${base}`;
  }

  async manageSlug(): Promise<void> {
    const currentSlug = this.currentSlug;
    const alert = await this.alertController.create({
      header: 'Gestionar subdominio',
      message: currentSlug
        ? `Subdominio actual: <strong>${currentSlug}</strong>`
        : 'Esta barbería no tiene subdominio asignado.',
      inputs: [
        {
          name: 'slug',
          type: 'text',
          placeholder: 'ej: barber-alem',
          value: currentSlug,
          attributes: { autocapitalize: 'none', autocorrect: 'off' },
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        ...(currentSlug ? [{
          text: 'Eliminar',
          cssClass: 'alert-button-danger',
          handler: () => { this.setSlug(null); return true; },
        }] : []),
        {
          text: currentSlug ? 'Actualizar' : 'Asignar',
          handler: (data: any) => {
            const newSlug = data.slug?.trim().toLowerCase();
            if (!newSlug) { this.showToast('Ingresá un slug', 'warning'); return false; }
            if (newSlug === currentSlug) { return true; }
            this.setSlug(newSlug);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  setSlugPublic(slug: string | null): void { this.setSlug(slug); }

  private setSlug(slug: string | null): void {
    if (!this.barbershop) return;
    this.barbershopsService.updateSlug(this.barbershop.id, slug).subscribe({
      next: (res: any) => {
        this.barbershop = { ...this.barbershop!, slug: res.data?.slug ?? slug ?? '' };
        const msg = slug ? `Subdominio actualizado: ${slug}` : 'Subdominio eliminado';
        this.showToast(msg, 'success');
      },
      error: (err: any) => {
        const msg = err?.error?.error?.message ?? 'Error al actualizar el subdominio';
        this.showToast(msg, 'danger');
      },
    });
  }

  async handleAdminAction(action: string): Promise<void> {
    switch (action) {
      case 'add-barber': return this.addBarber();
      case 'add-service': return this.addService();
      case 'assign-services': return this.assignServicesToBarber();
      case 'manage-schedules': return this.manageSchedules();
      case 'manage-plan': return this.openPlanManager();
      case 'edit-location': return this.editLocation();
      case 'manage-images': this.showImageManager = true; return;
      case 'manage-bank-account': this.showBankAccount = true; return;
      case 'manage-offers': return this.manageOffers();
      case 'manage-amenities': return this.manageAmenities();
      case 'edit-settings': return this.editSettings();
      case 'stats':     this.router.navigate(['/admin/tabs/dashboard'], { queryParams: { barbershopId: this.barbershop?.id } }); return;
      case 'payments':  this.router.navigate(['/admin/tabs/payments'],   { queryParams: { barbershopId: this.barbershop?.id } }); return;
    }
  }

  async addBarber(): Promise<void> {
    const services = this.barbershop?.services?.filter(s => s.isActive) || [];
    const inputs: any[] = [
      { name: 'email', type: 'email', placeholder: 'Email del usuario' },
      { name: 'bio', type: 'textarea', placeholder: 'Bio / Descripcion (opcional)' },
    ];

    const alert = await this.alertController.create({
      header: 'Nuevo Barbero',
      message: 'Ingresa el email de un usuario registrado.',
      inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Siguiente',
          handler: (data) => {
            if (!data.email) {
              this.showToast('El email es obligatorio', 'warning');
              return false;
            }
            if (services.length > 0) {
              this.selectBarberServices(data.email, data.bio, services);
            } else {
              this.createBarber(data.email, data.bio, []);
            }
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async selectBarberServices(email: string, bio: string, services: any[]): Promise<void> {
    const inputs = services.map((s: any) => ({
      type: 'checkbox' as const,
      label: `${s.service?.name || s.name} (${s.durationMin}min - $${s.price})`,
      value: s.service?.id || s.serviceId || s.id,
      checked: true,
    }));

    const alert = await this.alertController.create({
      header: 'Asignar Servicios',
      message: `Selecciona los servicios que ofrece este barbero.`,
      inputs,
      buttons: [
        { text: 'Atras', role: 'cancel' },
        {
          text: 'Crear Barbero',
          handler: (selectedIds: string[]) => {
            this.createBarber(email, bio, selectedIds);
          },
        },
      ],
    });
    await alert.present();
  }

  private createBarber(email: string, bio: string, serviceIds: string[]): void {
    this.barbersService.create({
      barbershopId: this.barbershop!.id,
      email,
      bio: bio || undefined,
      serviceIds: serviceIds.length > 0 ? serviceIds : undefined,
    }).subscribe({
      next: () => {
        this.showToast('Barbero agregado exitosamente', 'success');
        this.loadBarbershop(this.barbershop!.id);
      },
      error: (err: any) => {
        const msg = err?.error?.error?.message || 'Error al agregar barbero';
        this.showToast(msg, 'danger');
      },
    });
  }

  async assignServicesToBarber(): Promise<void> {
    const barbers = this.barbershop?.barbers?.filter(b => b.isActive) || [];
    if (!barbers.length) {
      this.showToast('No hay barberos para asignar servicios', 'warning');
      return;
    }

    const barberButtons = barbers.map((b) => ({
      text: `${b.firstName} ${b.lastName}`,
      handler: () => { this.showServiceAssignment(b); },
    }));
    barberButtons.push({ text: 'Cancelar', handler: () => {} });

    const alert = await this.alertController.create({
      header: 'Asignar Servicios',
      message: 'Selecciona un barbero',
      buttons: barberButtons,
    });
    await alert.present();
  }

  async showServiceAssignment(barber: any): Promise<void> {
    if (this.barbershop) {
      await new Promise<void>((resolve) => {
        this.barbershopsService.getOne(this.barbershop!.id).subscribe({
          next: (res) => { this.barbershop = res.data; resolve(); },
          error: () => resolve(),
        });
      });
    }

    const bsServices = this.barbershop?.services?.filter((bs: any) => bs.isActive !== false) || [];
    if (!bsServices.length) {
      this.showToast('No hay servicios creados', 'warning');
      return;
    }

    const currentServiceIds = (barber.services || []).map((bs: any) => bs.serviceId);
    const inputs = bsServices.map((bs: any) => ({
      type: 'checkbox' as const,
      label: `${bs.service?.name} - $${bs.price}`,
      value: bs.service?.id || bs.serviceId,
      checked: currentServiceIds.includes(bs.service?.id || bs.serviceId),
    }));

    const alert = await this.alertController.create({
      header: `Servicios - ${barber.firstName}`,
      inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (selectedIds: string[]) => {
            this.barbersService.assignServices(barber.id, selectedIds).subscribe({
              next: () => {
                this.showToast('Servicios actualizados', 'success');
                this.loadBarbershop(this.barbershop!.id);
              },
              error: () => this.showToast('Error al asignar servicios', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async addService(): Promise<void> {
    this.servicesService.getAll().subscribe({
      next: (res: any) => this.showAddServiceDialog(res.data),
      error: () => this.showToast('Error al cargar catalogo', 'danger'),
    });
  }

  async showAddServiceDialog(globalServices: any[]): Promise<void> {
    const existingIds = (this.barbershop?.services || []).map((bs: any) => bs.service?.id || bs.serviceId);
    const available = globalServices.filter((s: any) => !existingIds.includes(s.id));

    if (available.length === 0) {
      this.showCreateNewServiceDialog();
      return;
    }

    const inputs = available.map((s: any) => ({
      type: 'radio' as const,
      label: `${s.name} (${s.category || 'Sin categoria'})`,
      value: s.id,
    }));

    const alert = await this.alertController.create({
      header: 'Agregar Servicio',
      message: 'Selecciona del catalogo o crea uno nuevo.',
      inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Crear nuevo',
          handler: () => { this.showCreateNewServiceDialog(); },
        },
        {
          text: 'Siguiente',
          handler: (serviceId: string) => {
            if (!serviceId) {
              this.showToast('Selecciona un servicio', 'warning');
              return false;
            }
            const service = available.find((s: any) => s.id === serviceId);
            this.showServicePriceDialog(serviceId, service?.name || '');
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async showCreateNewServiceDialog(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Nuevo Servicio',
      message: 'Se agrega al catalogo global. Todas las barberias podran usarlo.',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre del servicio' },
        { name: 'description', type: 'textarea', placeholder: 'Descripcion (opcional)' },
        { name: 'category', type: 'text', placeholder: 'Categoria (ej: Corte, Barba)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Crear y continuar',
          handler: (data) => {
            if (!data.name) {
              this.showToast('El nombre es obligatorio', 'warning');
              return false;
            }
            this.servicesService.create({
              name: data.name,
              description: data.description || undefined,
              category: data.category || undefined,
            }).subscribe({
              next: (res: any) => {
                this.showToast('Servicio creado en el catalogo', 'success');
                this.showServicePriceDialog(res.data.id, data.name);
              },
              error: (err: any) => {
                const msg = err?.error?.error?.message || 'Error al crear servicio';
                this.showToast(msg, 'danger');
              },
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async showServicePriceDialog(serviceId: string, serviceName: string): Promise<void> {
    const alert = await this.alertController.create({
      header: `Precio - ${serviceName}`,
      message: 'Configura el precio y duracion para tu barberia.',
      inputs: [
        { name: 'price', type: 'number', placeholder: 'Precio ($)', min: 0 },
        { name: 'durationMin', type: 'number', placeholder: 'Duracion (minutos)', min: 10 },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            if (!data.price || !data.durationMin) {
              this.showToast('Precio y duracion son obligatorios', 'warning');
              return false;
            }
            this.servicesService.addToBarbershop({
              barbershopId: this.barbershop!.id,
              serviceId,
              price: parseFloat(data.price),
              durationMin: parseInt(data.durationMin, 10),
            }).subscribe({
              next: () => {
                this.showToast('Servicio agregado a tu barberia', 'success');
                this.loadBarbershop(this.barbershop!.id);
              },
              error: (err: any) => {
                const msg = err?.error?.error?.message || 'Error al agregar servicio';
                this.showToast(msg, 'danger');
              },
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  // ==================== SCHEDULES ====================

  readonly DAYS = [
    { key: 'LUNES', label: 'Lunes', short: 'Lu' },
    { key: 'MARTES', label: 'Martes', short: 'Ma' },
    { key: 'MIERCOLES', label: 'Miercoles', short: 'Mi' },
    { key: 'JUEVES', label: 'Jueves', short: 'Ju' },
    { key: 'VIERNES', label: 'Viernes', short: 'Vi' },
    { key: 'SABADO', label: 'Sabado', short: 'Sa' },
    { key: 'DOMINGO', label: 'Domingo', short: 'Do' },
  ];

  scheduleBarber: any = null;
  scheduleData: { day: string; label: string; enabled: boolean; openTime: string; closeTime: string }[] = [];
  showScheduleEditor = false;

  async manageSchedules(): Promise<void> {
    if (!this.barbershop?.barbers?.length) {
      this.showToast('Primero agrega un barbero para gestionar horarios', 'warning');
      return;
    }

    const barberButtons = this.barbershop.barbers.map((barber) => ({
      text: `${barber.firstName} ${barber.lastName}`,
      handler: () => { this.openScheduleEditor(barber); },
    }));
    barberButtons.push({ text: 'Cancelar', handler: () => {} });

    const alert = await this.alertController.create({
      header: 'Gestionar Horarios',
      message: 'Selecciona un barbero',
      buttons: barberButtons,
    });
    await alert.present();
  }

  openScheduleEditor(barber: any): void {
    this.scheduleBarber = barber;
    this.schedulesService.getByBarber(barber.id).subscribe({
      next: (res: any) => {
        const existing = res.data || [];
        this.scheduleData = this.DAYS.map(d => {
          const found = existing.find((s: any) => s.dayOfWeek === d.key);
          return {
            day: d.key,
            label: d.label,
            enabled: !!found,
            openTime: found?.openTime || '09:00',
            closeTime: found?.closeTime || '19:00',
          };
        });
        this.showScheduleEditor = true;
      },
      error: () => {
        this.scheduleData = this.DAYS.map(d => ({
          day: d.key, label: d.label, enabled: false, openTime: '09:00', closeTime: '19:00',
        }));
        this.showScheduleEditor = true;
      },
    });
  }

  applyToAllDays(): void {
    const first = this.scheduleData.find(d => d.enabled);
    const openTime = first?.openTime || '09:00';
    const closeTime = first?.closeTime || '19:00';
    for (const d of this.scheduleData) {
      d.enabled = true;
      d.openTime = openTime;
      d.closeTime = closeTime;
    }
    this.showToast('Horario aplicado a todos los dias', 'medium');
  }

  applyToWeekdays(): void {
    const weekdays = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
    const first = this.scheduleData.find(d => d.enabled);
    const openTime = first?.openTime || '09:00';
    const closeTime = first?.closeTime || '19:00';
    for (const d of this.scheduleData) {
      if (weekdays.includes(d.day)) {
        d.enabled = true;
        d.openTime = openTime;
        d.closeTime = closeTime;
      }
    }
    this.showToast('Horario aplicado L-V', 'medium');
  }

  saveSchedules(): void {
    if (!this.scheduleBarber) return;
    const enabledDays = this.scheduleData.filter(d => d.enabled);

    if (enabledDays.length === 0) {
      this.showToast('Selecciona al menos un dia', 'warning');
      return;
    }

    const groups = new Map<string, string[]>();
    for (const d of enabledDays) {
      const key = `${d.openTime}-${d.closeTime}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d.day);
    }

    let completed = 0;
    const total = groups.size;

    groups.forEach((days, key) => {
      const [openTime, closeTime] = key.split('-');
      this.schedulesService.create({
        barberId: this.scheduleBarber.id,
        daysOfWeek: days,
        openTime,
        closeTime,
        slotDurationMinutes: 30,
      }).subscribe({
        next: () => {
          completed++;
          if (completed === total) {
            this.showToast('Horarios guardados', 'success');
            this.showScheduleEditor = false;
            this.loadBarbershop(this.barbershop!.id);
          }
        },
        error: () => {
          completed++;
          if (completed === total) {
            this.showToast('Error al guardar algunos horarios', 'danger');
          }
        },
      });
    });
  }

  closeScheduleEditor(): void {
    this.showScheduleEditor = false;
    this.scheduleBarber = null;
  }

  async manageOffers(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Nueva Oferta',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre de la oferta' },
        { name: 'description', type: 'textarea', placeholder: 'Descripcion' },
        { name: 'discountValue', type: 'number', placeholder: 'Valor descuento' },
      ],
      message: 'Descuento porcentual. Se aplicara a todos los servicios.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Crear',
          handler: (data) => {
            if (!data.name || !data.discountValue) {
              this.showToast('Nombre y valor son obligatorios', 'warning');
              return false;
            }
            const now = new Date();
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const body = {
              barbershopId: this.barbershop!.id,
              name: data.name,
              description: data.description || undefined,
              discountType: 'PORCENTAJE',
              discountValue: parseFloat(data.discountValue),
              validFrom: now.toISOString(),
              validUntil: nextMonth.toISOString(),
            };
            this.http.post<any>(`${environment.apiUrl}/offers`, body).subscribe({
              next: () => {
                this.showToast('Oferta creada', 'success');
                this.loadBarbershop(this.barbershop!.id);
              },
              error: () => this.showToast('Error al crear oferta', 'danger'),
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async manageAmenities(): Promise<void> {
    this.amenitiesService.getAll().subscribe({
      next: (res) => {
        this.allAmenities = res.data;
        this.barbershopAmenityIds = (this.barbershop?.amenities || []).map(a => a.amenityId);
        this.showAmenitiesAlert();
      },
    });
  }

  async showAmenitiesAlert(): Promise<void> {
    const inputs = this.allAmenities.map((amenity) => ({
      type: 'checkbox' as const,
      label: amenity.name,
      value: amenity.id,
      checked: this.barbershopAmenityIds.includes(amenity.id),
    }));

    const alert = await this.alertController.create({
      header: 'Caracteristicas',
      message: 'Selecciona las caracteristicas de tu barberia',
      inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (selectedIds: string[]) => {
            this.saveAmenities(selectedIds);
          },
        },
      ],
    });
    await alert.present();
  }

  saveAmenities(selectedIds: string[]): void {
    const current = new Set(this.barbershopAmenityIds);
    const selected = new Set(selectedIds);

    const toToggle: string[] = [];
    for (const id of selectedIds) {
      if (!current.has(id)) toToggle.push(id);
    }
    for (const id of this.barbershopAmenityIds) {
      if (!selected.has(id)) toToggle.push(id);
    }

    if (toToggle.length === 0) return;

    let completed = 0;
    for (const amenityId of toToggle) {
      this.amenitiesService.toggle(this.barbershop!.id, amenityId).subscribe({
        next: () => {
          completed++;
          if (completed === toToggle.length) {
            this.showToast('Caracteristicas actualizadas', 'success');
            this.loadBarbershop(this.barbershop!.id);
          }
        },
        error: () => {
          completed++;
        },
      });
    }
  }

  async editSettings(): Promise<void> {
    const bs = this.barbershop!;
    const alert = await this.alertController.create({
      header: 'Configuracion',
      inputs: [
        { name: 'description', type: 'textarea', placeholder: 'Descripcion', value: bs.description || '' },
        { name: 'phone', type: 'tel', placeholder: 'Telefono', value: bs.phone || '' },
        { name: 'depositAmount', type: 'number', placeholder: 'Monto sena', value: bs.depositAmount?.toString() || '0' },
        { name: 'cancellationHours', type: 'number', placeholder: 'Hs cancelacion', value: bs.cancellationHours?.toString() || '12' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            this.barbershopsService.update(bs.id, {
              description: data.description || undefined,
              phone: data.phone || undefined,
              depositAmount: parseFloat(data.depositAmount) || 0,
              cancellationHours: parseInt(data.cancellationHours, 10) || 12,
            } as any).subscribe({
              next: () => {
                this.showToast('Configuracion guardada', 'success');
                this.loadBarbershop(bs.id);
              },
              error: () => this.showToast('Error al guardar', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  // ==================== PLAN MANAGER ====================

  openPlanManager(): void {
    this.showPlanManager = true;
    this.planLoading = true;
    this.http.get<any>(`${environment.apiUrl}/mp/subscriptions/${this.barbershop!.id}/status`).subscribe({
      next: (res) => { this.planStatus = res.data ?? res; this.planLoading = false; },
      error: () => { this.planLoading = false; },
    });
  }

  closePlanManager(): void { this.showPlanManager = false; }

  getCurrentPlan(): string {
    return this.barbershop?.subscription?.plan ?? 'GRATUITO';
  }

  activateSuscripcion(): void {
    const email = this.authService.currentUser?.email;
    if (!email) { this.showToast('No se pudo obtener el email', 'danger'); return; }

    this.http.post<any>(
      `${environment.apiUrl}/mp/subscriptions/${this.barbershop!.id}`,
      { payerEmail: email },
    ).subscribe({
      next: (res) => {
        const url = res.data?.initPoint ?? res.initPoint;
        if (url) window.open(url, '_blank');
        this.closePlanManager();
      },
      error: () => this.showToast('Error al iniciar suscripción', 'danger'),
    });
  }

  activateComision(): void {
    this.barbershopsService.update(this.barbershop!.id, { businessModel: 'COMISION' } as any).subscribe({
      next: () => {
        this.http.post<any>(`${environment.apiUrl}/barbershops/${this.barbershop!.id}/subscription/comision`, {}).subscribe({
          next: () => { this.showToast('Plan Comisión activado', 'success'); this.loadBarbershop(this.barbershop!.id); this.closePlanManager(); },
          error: () => this.showToast('Error al activar plan', 'danger'),
        });
      },
      error: () => this.showToast('Error al actualizar plan', 'danger'),
    });
  }

  cancelPlan(): void {
    this.http.delete<any>(`${environment.apiUrl}/mp/subscriptions/${this.barbershop!.id}`).subscribe({
      next: () => { this.showToast('Suscripción cancelada', 'success'); this.loadBarbershop(this.barbershop!.id); this.closePlanManager(); },
      error: () => this.showToast('Error al cancelar', 'danger'),
    });
  }

  // ==================== LOCATION ====================

  async editLocation(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Ubicación',
      message: 'Ingresa la nueva dirección de la barbería.',
      inputs: [
        {
          name: 'address',
          type: 'text',
          placeholder: 'Ej: Av. Corrientes 1234, Buenos Aires',
          value: this.barbershop?.address || '',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Geocodificar y guardar',
          handler: (data) => {
            const address = data.address?.trim();
            if (!address) {
              this.showToast('Ingresa una dirección', 'warning');
              return false;
            }
            this.geocodingService.validateAddress(address).subscribe({
              next: (res: any) => {
                const result = res?.data ?? res;
                this.barbershopsService.update(this.barbershop!.id, {
                  address: result.formattedAddress || address,
                  latitude: result.lat,
                  longitude: result.lng,
                } as any).subscribe({
                  next: () => {
                    this.showToast('Ubicación actualizada', 'success');
                    this.loadBarbershop(this.barbershop!.id);
                  },
                  error: () => this.showToast('Error al guardar', 'danger'),
                });
              },
              error: () => this.showToast('No se pudo geocodificar la dirección', 'danger'),
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  getMapUrl(): SafeResourceUrl {
    const { latitude: lat, longitude: lng } = this.barbershop!;
    const d = 0.008;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${lng! - d},${lat! - d},${lng! + d},${lat! + d}&layer=mapnik&marker=${lat},${lng}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  openDirections(): void {
    const { latitude: lat, longitude: lng, address } = this.barbershop!;
    const dest = lat && lng ? `${lat},${lng}` : encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  }

  // ==================== IMAGE MANAGER ====================

  closeImageManager(): void {
    this.showImageManager = false;
  }

  triggerFileInput(target: string): void {
    if (this.uploadStatus !== 'idle') return;
    this.uploadingFor = target;
    const input = document.getElementById('imageFileInput') as HTMLInputElement;
    input?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.uploadingFor) return;
    input.value = '';

    const target = this.uploadingFor;
    this.uploadingFor = null;
    this.uploadStatus = 'compressing';
    this.uploadProgress = 0;

    const type = this.getImageTypeForTarget(target);

    this.uploadService.uploadImage(file, type).subscribe({
      next: (evt: UploadEvent) => {
        if (evt.progress < 100) {
          this.uploadStatus = 'uploading';
          this.uploadProgress = evt.progress;
        } else {
          this.uploadProgress = 100;
          this.uploadStatus = 'idle';
          this.linkImage(target, evt.image!.id);
        }
      },
      error: () => {
        this.uploadStatus = 'idle';
        this.uploadProgress = 0;
        this.showToast('Error al subir imagen', 'danger');
      },
    });
  }

  private getImageTypeForTarget(target: string): ImageType {
    if (target === 'logo') return 'ICONO';
    if (target === 'cover') return 'PORTADA';
    if (target === 'gallery') return 'GALERIA';
    return 'PERFIL';
  }

  private linkImage(target: string, imageId: string): void {
    const reload = () => this.loadBarbershop(this.barbershop!.id);

    if (target === 'logo' || target === 'cover' || target === 'gallery') {
      this.barbershopsService.addImage(this.barbershop!.id, imageId).subscribe({
        next: () => { this.showToast('Imagen actualizada', 'success'); reload(); },
        error: (err: any) => {
          const msg = err?.error?.error?.message || 'Error al guardar imagen';
          this.showToast(msg, 'danger');
        },
      });
    } else if (target.startsWith('avatar-')) {
      const barberId = target.replace('avatar-', '');
      this.barbersService.addImage(barberId, imageId).subscribe({
        next: () => { this.showToast('Avatar actualizado', 'success'); reload(); },
        error: (err: any) => {
          const msg = err?.error?.error?.message || 'Error al guardar imagen';
          this.showToast(msg, 'danger');
        },
      });
    }
  }

  getBarbershopImage(type: ImageType): { url: string } | undefined {
    return this.barbershop?.images?.find(i => i.image.type === type)?.image;
  }

  getBarberImage(barber: Barber, type: ImageType): { url: string } | undefined {
    return barber.images?.find(i => i.image.type === type)?.image;
  }

  getBarberGallery(barber: Barber) {
    return barber.images?.filter(i => i.image.type === 'GALERIA') ?? [];
  }

  getBarberGalleryUrls(barber: Barber): string[] {
    return this.getBarberGallery(barber).map(r => r.image.url);
  }

  getBarbershopGallery() {
    return this.barbershop?.images?.filter(i => i.image.type === 'GALERIA') ?? [];
  }

  getBarbershopGalleryUrls(): string[] {
    return this.getBarbershopGallery().map(r => r.image.url);
  }

  deleteBarberImage(relationId: string): void {
    this.barbersService.removeImage(relationId).subscribe({
      next: () => { this.showToast('Imagen eliminada', 'success'); this.loadBarbershop(this.barbershop!.id); },
      error: () => this.showToast('Error al eliminar imagen', 'danger'),
    });
  }

  deleteBarbershopImage(imageId: string): void {
    this.barbershopsService.removeImage(this.barbershop!.id, imageId).subscribe({
      next: () => { this.showToast('Imagen eliminada', 'success'); this.loadBarbershop(this.barbershop!.id); },
      error: () => this.showToast('Error al eliminar imagen', 'danger'),
    });
  }

  getMaxImages(): number {
    return this.barbershop?.maxBarberImages ?? 3;
  }

  async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
