import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AlertController, ToastController } from '@ionic/angular';
import { BarbershopsService } from '../../services/barbershops.service';
import { BarbersService } from '../../services/barbers.service';
import { ServicesService } from '../../services/services.service';
import { SchedulesService } from '../../services/schedules.service';
import { AmenitiesService } from '../../services/amenities.service';
import { AuthService } from '../../core/services/auth.service';
import { Barbershop, Amenity } from '../../shared/models';
import { environment } from '../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-barbershop-detail',
  templateUrl: './barbershop-detail.page.html',
  styleUrls: ['./barbershop-detail.page.scss'],
})
export class BarbershopDetailPage implements OnInit {
  barbershop: Barbershop | null = null;
  isLoading = true;
  error: string | null = null;

  isAdmin = false;
  allAmenities: Amenity[] = [];
  barbershopAmenityIds: string[] = [];

  adminMenuItems = [
    { icon: 'person-add-outline', label: 'Agregar Barbero', action: 'add-barber' },
    { icon: 'cut-outline', label: 'Agregar Servicio', action: 'add-service' },
    { icon: 'link-outline', label: 'Asignar Servicios', action: 'assign-services' },
    { icon: 'time-outline', label: 'Gestionar Horarios', action: 'manage-schedules' },
    { icon: 'pricetag-outline', label: 'Ofertas', action: 'manage-offers' },
    { icon: 'leaf-outline', label: 'Caracteristicas', action: 'manage-amenities' },
    { icon: 'settings-outline', label: 'Configuracion', action: 'edit-settings' },
  ];

  constructor(
    private route: ActivatedRoute,
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
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')
      ?? this.route.snapshot.parent?.paramMap.get('id')
      ?? null;

    if (id) {
      this.loadBarbershop(id);
    } else {
      this.error = 'ID de barberia no encontrado.';
      this.isLoading = false;
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
    const role = this.authService.activeRole;
    if (role === 'ADMIN_GENERAL') {
      this.isAdmin = true;
      return;
    }
    if (role === 'ADMIN_BARBERSHOP' || role === 'SUB_ADMIN') {
      // Check via API if user is admin of this barbershop
      this.barbershopsService.getMyBarbershops().subscribe({
        next: (res: any) => {
          const myBarbershops = Array.isArray(res.data) ? res.data : [];
          this.isAdmin = myBarbershops.some(
            (bs: any) => bs.id === this.barbershop?.id
          );
        },
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/tabs/home']);
  }

  navigateToBooking(): void {
    if (this.barbershop) {
      this.router.navigate(['/booking-flow'], {
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

  async handleAdminAction(action: string): Promise<void> {
    switch (action) {
      case 'add-barber': return this.addBarber();
      case 'add-service': return this.addService();
      case 'assign-services': return this.assignServicesToBarber();
      case 'manage-schedules': return this.manageSchedules();
      case 'manage-offers': return this.manageOffers();
      case 'manage-amenities': return this.manageAmenities();
      case 'edit-settings': return this.editSettings();
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
    // Reload barbershop to ensure services have nested service data
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
    // First load global services catalog to let admin pick or create
    this.servicesService.getAll().subscribe({
      next: (res: any) => this.showAddServiceDialog(res.data),
      error: () => this.showToast('Error al cargar catalogo', 'danger'),
    });
  }

  async showAddServiceDialog(globalServices: any[]): Promise<void> {
    // Show existing services as checkboxes + option to create new
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
    // Load existing schedules
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

    // Group by same openTime+closeTime to minimize API calls
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

    // Toggle los que cambiaron
    const toToggle: string[] = [];
    for (const id of selectedIds) {
      if (!current.has(id)) toToggle.push(id); // agregar
    }
    for (const id of this.barbershopAmenityIds) {
      if (!selected.has(id)) toToggle.push(id); // quitar
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
