import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AlertController, ToastController } from '@ionic/angular';
import { ApiService } from '../../../../core/client-api.service';
import { BarbershopResolverService } from '../../../../core/barbershop-resolver.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-admin-barber-panel',
  templateUrl: './admin-barber-panel.page.html',
  styleUrls: ['./admin-barber-panel.page.scss'],
  standalone: false,
})
export class AdminBarberPanelPage implements OnInit {

  loading = true;
  barbershop: any = null;
  barbers: any[] = [];
  services: any[] = [];
  amenities: any[] = [];
  offers: any[] = [];
  hasSchedules = true;

  // Plan manager overlay
  showPlanManager = false;
  planStatus: any = null;
  planLoading = false;

  // Image manager overlay
  showImageManager = false;
  imageManagerType: 'PORTADA' | 'ICONO' | 'GALERIA' = 'PORTADA';
  uploadingImage = false;

  // Deposit manager overlay
  showDepositManager = false;
  depositTypeLocal: 'FIXED' | 'PERCENTAGE' = 'FIXED';
  depositAmountLocal = 0;
  depositSaving = false;

  // Agenda
  showBarberAgenda: Record<string, boolean> = {};
  barberAgendaSlots: any[] = [];

  // Schedule editor
  showScheduleEditor = false;
  scheduleBarber: any = null;
  scheduleData: { day: string; label: string; enabled: boolean; openTime: string; closeTime: string }[] = [];
  readonly DAYS = [
    { key: 'LUNES',     label: 'Lunes' },
    { key: 'MARTES',    label: 'Martes' },
    { key: 'MIERCOLES', label: 'Miércoles' },
    { key: 'JUEVES',    label: 'Jueves' },
    { key: 'VIERNES',   label: 'Viernes' },
    { key: 'SABADO',    label: 'Sábado' },
    { key: 'DOMINGO',   label: 'Domingo' },
  ];

  private offerDraft: any = {};
  private apiUrl = environment.apiUrl;
  private get bsId() { return environment.barbershopId; }

  // ── Items del panel (mismos que admin/barbershop/:id + Estadísticas) ──
  adminMenuItems = [
    { icon: 'person-add-outline',  label: 'Agregar Barbero',   action: 'add-barber' },
    { icon: 'cut-outline',         label: 'Agregar Servicio',  action: 'add-service' },
    { icon: 'link-outline',        label: 'Asignar Servicios', action: 'assign-services' },
    { icon: 'time-outline',        label: 'Horarios',          action: 'manage-schedules' },
    { icon: 'card-outline',        label: 'Plan',              action: 'manage-plan' },
    { icon: 'location-outline',    label: 'Ubicación',         action: 'edit-location' },
    { icon: 'images-outline',      label: 'Imágenes',          action: 'manage-images' },
    { icon: 'pricetag-outline',    label: 'Ofertas',           action: 'manage-offers' },
    { icon: 'leaf-outline',        label: 'Características',   action: 'manage-amenities' },
    { icon: 'settings-outline',    label: 'Configuración',     action: 'edit-settings' },
    { icon: 'stats-chart-outline', label: 'Estadísticas',      action: 'dashboard' },
    { icon: 'wallet-outline',      label: 'Pagos y deudas',    action: 'payments' },
    { icon: 'cash-outline',        label: 'Seña',              action: 'manage-deposit' },
    { icon: 'globe-outline',       label: 'Subdominio',        action: 'manage-subdomain' },
  ];

  constructor(
    private api: ApiService,
    private http: HttpClient,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private resolver: BarbershopResolverService,
  ) {}

  ngOnInit(): void { this.loadData(); }
  ionViewWillEnter(): void { this.loadData(); }

  loadData(): void {
    this.loading = true;
    if (this.resolver.barbershop) { this.populate(this.resolver.barbershop); return; }
    this.api.getBarbershop().subscribe({
      next: (res: any) => this.populate(res.data ?? res),
      error: () => { this.loading = false; },
    });
  }

  private populate(data: any): void {
    this.barbershop = data;
    this.barbers    = (data.barbers   ?? []).filter((b: any) => b.isActive);
    this.services   = data.services   ?? [];
    this.amenities  = data.amenities  ?? [];
    this.offers     = (data.offers    ?? []).filter((o: any) => o.isActive);
    this.loading    = false;
    this.checkSchedules();
  }

  private checkSchedules(): void {
    const first = this.barbers[0];
    if (!first) { this.hasSchedules = false; return; }
    this.http.get<any>(`${this.apiUrl}/schedules/barber/${first.id}`).subscribe({
      next: (res: any) => { this.hasSchedules = (res.data || []).length > 0; },
      error: () => { this.hasSchedules = false; },
    });
  }

  doRefresh(event: any): void {
    this.api.getBarbershop().subscribe({
      next: (res: any) => { this.populate(res.data ?? res); event.target.complete(); },
      error: () => event.target.complete(),
    });
  }

  // ── Router de acciones ────────────────────────────────────────────────
  async handleAction(action: string): Promise<void> {
    switch (action) {
      case 'add-barber':       return this.addBarber();
      case 'add-service':      return this.addService();
      case 'assign-services':  return this.assignServicesToBarber();
      case 'manage-schedules': return this.manageSchedules();
      case 'manage-plan':      return this.openPlanManager();
      case 'edit-location':    return this.editLocation();
      case 'manage-images':    this.showImageManager = true; return;
      case 'manage-offers':    return this.manageOffers();
      case 'manage-amenities': return this.manageAmenities();
      case 'edit-settings':    return this.editSettings();
      case 'dashboard':        this.router.navigate(['/tabs/dashboard']); return;
      case 'payments':         this.router.navigate(['/tabs/payments']);  return;
      case 'manage-deposit':   return this.openDepositManager();
      case 'manage-subdomain': return this.manageSubdomain();
    }
  }

  handleAlertAction(action: string): void { this.handleAction(action); }

  // ── Agenda ────────────────────────────────────────────────────────────
  toggleBarberAgenda(barber: any): void {
    this.showBarberAgenda[barber.id] = !this.showBarberAgenda[barber.id];
    if (this.showBarberAgenda[barber.id]) {
      const today = new Date().toISOString().split('T')[0];
      this.http.get<any>(`${this.apiUrl}/barbers/my-agenda/${today}`).subscribe({
        next: (res: any) => { this.barberAgendaSlots = res.data?.slots ?? res.data ?? []; },
        error: () => { this.barberAgendaSlots = []; },
      });
    }
  }

  // ── Agregar barbero ───────────────────────────────────────────────────
  async addBarber(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo Barbero',
      message: 'Ingresá el email de un usuario registrado.',
      inputs: [
        { name: 'email', type: 'email', placeholder: 'Email del usuario' },
        { name: 'bio', type: 'textarea', placeholder: 'Bio / Descripción (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Agregar', handler: (data) => {
          if (!data.email) { this.toast('El email es obligatorio', 'warning'); return false; }
          this.http.post<any>(`${this.apiUrl}/barbers`, { barbershopId: this.bsId, email: data.email, bio: data.bio || undefined })
            .subscribe({ next: () => { this.toast('Barbero agregado', 'success'); this.loadData(); }, error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger') });
          return true;
        }},
      ],
    });
    await alert.present();
  }

  // ── Agregar servicio ──────────────────────────────────────────────────
  async addService(): Promise<void> {
    this.http.get<any>(`${this.apiUrl}/services`).subscribe({
      next: async (res: any) => {
        const all = res.data || [];
        const existingIds = this.services.map((s: any) => s.service?.id || s.serviceId);
        const available = all.filter((s: any) => !existingIds.includes(s.id));
        const inputs = available.map((s: any) => ({ type: 'radio' as const, label: `${s.name} (${s.category || ''})`, value: s.id }));
        const alert = await this.alertCtrl.create({
          header: 'Agregar Servicio', inputs,
          buttons: [
            { text: 'Cancelar', role: 'cancel' },
            { text: 'Crear nuevo', handler: () => { this.createNewService(); } },
            { text: 'Siguiente', handler: (id: string) => {
              if (!id) { this.toast('Seleccioná uno', 'warning'); return false; }
              this.setServicePrice(id, all.find((s: any) => s.id === id)?.name || '');
              return true;
            }},
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
        { name: 'description', type: 'textarea', placeholder: 'Descripción (opcional)' },
        { name: 'category', type: 'text', placeholder: 'Categoría' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Crear', handler: (data) => {
          if (!data.name) return false;
          this.http.post<any>(`${this.apiUrl}/services`, data).subscribe({
            next: (res: any) => { this.setServicePrice(res.data.id, data.name); },
            error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
          });
          return true;
        }},
      ],
    });
    await alert.present();
  }

  async setServicePrice(serviceId: string, name: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: `Precio — ${name}`,
      inputs: [
        { name: 'price', type: 'number', placeholder: 'Precio ($)' },
        { name: 'durationMin', type: 'number', placeholder: 'Duración (min)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (data) => {
          if (!data.price || !data.durationMin) return false;
          this.http.post<any>(`${this.apiUrl}/services/barbershop`, { barbershopId: this.bsId, serviceId, price: parseFloat(data.price), durationMin: parseInt(data.durationMin, 10) })
            .subscribe({ next: () => { this.toast('Servicio agregado', 'success'); this.loadData(); }, error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger') });
          return true;
        }},
      ],
    });
    await alert.present();
  }

  // ── Asignar servicios a barbero ───────────────────────────────────────
  async assignServicesToBarber(): Promise<void> {
    if (!this.barbers.length) { this.toast('No hay barberos', 'warning'); return; }
    const buttons = this.barbers.map((b: any) => ({
      text: `${b.firstName} ${b.lastName}`,
      handler: () => { this.showServiceAssignment(b); },
    }));
    buttons.push({ text: 'Cancelar', handler: () => {} });
    const alert = await this.alertCtrl.create({ header: 'Asignar Servicios', message: 'Seleccioná un barbero', buttons });
    await alert.present();
  }

  async showServiceAssignment(barber: any): Promise<void> {
    const bsServices = this.services.filter((bs: any) => bs.isActive !== false);
    if (!bsServices.length) { this.toast('No hay servicios creados', 'warning'); return; }
    const currentIds = (barber.services || []).map((bs: any) => bs.serviceId);
    const inputs = bsServices.map((bs: any) => ({
      type: 'checkbox' as const,
      label: `${bs.service?.name} - $${bs.price}`,
      value: bs.service?.id || bs.serviceId,
      checked: currentIds.includes(bs.service?.id || bs.serviceId),
    }));
    const alert = await this.alertCtrl.create({
      header: `Servicios — ${barber.firstName}`, inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (selected: string[]) => {
          this.http.put<any>(`${this.apiUrl}/barbers/${barber.id}/services`, { serviceIds: selected })
            .subscribe({ next: () => { this.toast('Servicios actualizados', 'success'); this.loadData(); }, error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger') });
        }},
      ],
    });
    await alert.present();
  }

  // ── Horarios ──────────────────────────────────────────────────────────
  async manageSchedules(): Promise<void> {
    if (!this.barbers.length) { this.toast('Primero agregá un barbero', 'warning'); return; }
    const buttons = this.barbers.map((b: any) => ({ text: `${b.firstName} ${b.lastName}`, handler: () => { this.openScheduleEditor(b); } }));
    buttons.push({ text: 'Cancelar', handler: () => {} });
    const alert = await this.alertCtrl.create({ header: 'Horarios', message: 'Seleccioná barbero', buttons });
    await alert.present();
  }

  openScheduleEditor(barber: any): void {
    this.scheduleBarber = barber;
    this.http.get<any>(`${this.apiUrl}/schedules/barber/${barber.id}`).subscribe({
      next: (res: any) => {
        const existing = res.data || [];
        this.scheduleData = this.DAYS.map(d => {
          const found = existing.find((s: any) => s.dayOfWeek === d.key);
          return { day: d.key, label: d.label, enabled: !!found, openTime: found?.openTime || '09:00', closeTime: found?.closeTime || '19:00' };
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
    const open = first?.openTime || '09:00'; const close = first?.closeTime || '19:00';
    this.scheduleData.forEach(d => { d.enabled = true; d.openTime = open; d.closeTime = close; });
  }

  applyToWeekdays(): void {
    const days = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
    const first = this.scheduleData.find(d => d.enabled);
    const open = first?.openTime || '09:00'; const close = first?.closeTime || '19:00';
    this.scheduleData.forEach(d => { if (days.includes(d.day)) { d.enabled = true; d.openTime = open; d.closeTime = close; } });
  }

  saveSchedules(): void {
    if (!this.scheduleBarber) return;
    const enabled = this.scheduleData.filter(d => d.enabled);
    if (!enabled.length) { this.toast('Seleccioná al menos un día', 'warning'); return; }
    const groups = new Map<string, string[]>();
    for (const d of enabled) {
      const key = `${d.openTime}-${d.closeTime}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d.day);
    }
    let done = 0; const total = groups.size;
    groups.forEach((days, key) => {
      const [openTime, closeTime] = key.split('-');
      this.http.post<any>(`${this.apiUrl}/schedules`, { barberId: this.scheduleBarber.id, daysOfWeek: days, openTime, closeTime, slotDurationMinutes: 30 })
        .subscribe({
          next: () => { done++; if (done === total) { this.toast('Horarios guardados', 'success'); this.showScheduleEditor = false; this.loadData(); } },
          error: () => { done++; if (done === total) this.toast('Error', 'danger'); },
        });
    });
  }

  closeScheduleEditor(): void { this.showScheduleEditor = false; this.scheduleBarber = null; }

  // ── Plan ──────────────────────────────────────────────────────────────
  openPlanManager(): void {
    this.showPlanManager = true;
    this.planLoading = true;
    this.http.get<any>(`${this.apiUrl}/mp/subscriptions/${this.bsId}/status`).subscribe({
      next: (res: any) => { this.planStatus = res.data ?? res; this.planLoading = false; },
      error: () => { this.planLoading = false; },
    });
  }

  closePlanManager(): void { this.showPlanManager = false; }

  get currentPlan(): string { return this.barbershop?.subscription?.plan ?? 'GRATUITO'; }

  activarSuscripcion(): void {
    this.http.post<any>(`${this.apiUrl}/mp/subscriptions/${this.bsId}`, {}).subscribe({
      next: (res: any) => {
        const url = res.data?.initPoint ?? res.initPoint;
        if (url) window.open(url, '_blank');
        this.closePlanManager();
      },
      error: () => this.toast('Error al iniciar suscripción', 'danger'),
    });
  }

  activarComision(): void {
    this.http.post<any>(`${this.apiUrl}/barbershops/${this.bsId}/subscription/comision`, {}).subscribe({
      next: () => { this.toast('Plan Comisión activado', 'success'); this.loadData(); this.closePlanManager(); },
      error: () => this.toast('Error al activar plan', 'danger'),
    });
  }

  cancelarPlan(): void {
    this.http.delete<any>(`${this.apiUrl}/mp/subscriptions/${this.bsId}`).subscribe({
      next: () => { this.toast('Suscripción cancelada', 'success'); this.loadData(); this.closePlanManager(); },
      error: () => this.toast('Error al cancelar', 'danger'),
    });
  }

  // ── Ubicación ─────────────────────────────────────────────────────────
  async editLocation(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Ubicación',
      message: 'Ingresá la nueva dirección de la barbería.',
      inputs: [{ name: 'address', type: 'text', placeholder: 'Ej: Av. Corrientes 1234', value: this.barbershop?.address || '' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (data) => {
          const address = data.address?.trim();
          if (!address) { this.toast('Ingresá una dirección', 'warning'); return false; }
          this.http.post<any>(`${this.apiUrl}/geocoding/validate-address`, { address }).subscribe({
            next: (res: any) => {
              const r = res?.data ?? res;
              this.http.put<any>(`${this.apiUrl}/barbershops/${this.bsId}`, { address: r.formattedAddress || address, latitude: r.lat, longitude: r.lng })
                .subscribe({ next: () => { this.toast('Ubicación actualizada', 'success'); this.loadData(); }, error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger') });
            },
            error: () => this.toast('No se pudo geocodificar la dirección', 'danger'),
          });
          return true;
        }},
      ],
    });
    await alert.present();
  }

  // ── Imágenes ──────────────────────────────────────────────────────────
  openImageManager(type: 'PORTADA' | 'ICONO' | 'GALERIA' = 'PORTADA'): void {
    this.imageManagerType = type;
    this.showImageManager = true;
  }

  closeImageManager(): void { this.showImageManager = false; }

  triggerFileInput(type: 'PORTADA' | 'ICONO' | 'GALERIA'): void {
    this.imageManagerType = type;
    const input = document.getElementById(`file-input-${type}`) as HTMLInputElement;
    input?.click();
  }

  onFileSelected(event: any, type: string): void {
    const file: File = event.target.files[0];
    if (!file) return;
    this.uploadingImage = true;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    this.http.post<any>(`${this.apiUrl}/upload/image`, formData).subscribe({
      next: (res: any) => {
        const imageId = res.data?.id ?? res.id;
        this.http.post<any>(`${this.apiUrl}/barbershops/${this.bsId}/images`, { imageId }).subscribe({
          next: () => { this.toast('Imagen subida', 'success'); this.loadData(); this.uploadingImage = false; },
          error: () => { this.toast('Error al asociar imagen', 'danger'); this.uploadingImage = false; },
        });
      },
      error: () => { this.toast('Error al subir imagen', 'danger'); this.uploadingImage = false; },
    });
  }

  getImage(type: string): string | null {
    return this.barbershop?.images?.find((i: any) => i.image?.type === type)?.image?.url ?? null;
  }

  deleteImage(imageId: string): void {
    this.http.delete<any>(`${this.apiUrl}/barbershops/${this.bsId}/images/${imageId}`).subscribe({
      next: () => { this.toast('Imagen eliminada', 'success'); this.loadData(); },
      error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger'),
    });
  }

  getImageId(type: string): string | null {
    return this.barbershop?.images?.find((i: any) => i.image?.type === type)?.id ?? null;
  }

  // ── Ofertas ───────────────────────────────────────────────────────────
  async manageOffers(): Promise<void> {
    this.offerDraft = {};
    const alert = await this.alertCtrl.create({
      header: 'Nueva Oferta — Paso 1/3',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre de la oferta' },
        { name: 'description', type: 'textarea', placeholder: 'Descripción (opcional)' },
        { name: 'discountValue', type: 'number', placeholder: 'Valor del descuento' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Siguiente', handler: (data) => {
          if (!data.name || !data.discountValue) { this.toast('Nombre y descuento obligatorios'); return false; }
          this.offerDraft = { ...data, discountValue: parseFloat(data.discountValue) };
          this.offerStep2(); return true;
        }},
      ],
    });
    await alert.present();
  }

  async offerStep2(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const next = new Date(); next.setMonth(next.getMonth() + 1);
    const alert = await this.alertCtrl.create({
      header: 'Oferta — Paso 2/3',
      inputs: [
        { name: 'validFrom', type: 'date', label: 'Desde', value: today },
        { name: 'validUntil', type: 'date', label: 'Hasta', value: next.toISOString().split('T')[0] },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Siguiente', handler: (data) => {
          this.offerDraft = { ...this.offerDraft, validFrom: new Date(data.validFrom).toISOString(), validUntil: new Date(data.validUntil).toISOString() };
          this.offerStep3(); return true;
        }},
      ],
    });
    await alert.present();
  }

  async offerStep3(): Promise<void> {
    const inputs = [
      ...this.services.map((s: any) => ({ type: 'checkbox' as const, label: s.service?.name || s.name, value: `svc:${s.service?.id || s.serviceId}`, checked: true })),
      ...this.barbers.map((b: any) => ({ type: 'checkbox' as const, label: `${b.firstName} ${b.lastName}`, value: `bar:${b.id}`, checked: true })),
    ];
    const alert = await this.alertCtrl.create({
      header: 'Oferta — Paso 3/3', inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Crear Oferta', handler: (selected: string[]) => {
          const serviceIds = selected.filter(v => v.startsWith('svc:')).map(v => v.replace('svc:', ''));
          const barberIds  = selected.filter(v => v.startsWith('bar:')).map(v => v.replace('bar:', ''));
          const appliesToAll = serviceIds.length === this.services.length && barberIds.length === this.barbers.length;
          this.http.post<any>(`${this.apiUrl}/offers`, { barbershopId: this.bsId, ...this.offerDraft, discountType: 'PORCENTAJE', serviceIds: appliesToAll ? [] : serviceIds, barberIds: appliesToAll ? [] : barberIds, appliesToAll })
            .subscribe({ next: () => { this.toast('Oferta creada', 'success'); this.loadData(); }, error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger') });
        }},
      ],
    });
    await alert.present();
  }

  // ── Características ───────────────────────────────────────────────────
  async manageAmenities(): Promise<void> {
    this.http.get<any>(`${this.apiUrl}/amenities`).subscribe({
      next: async (res: any) => {
        const all = res.data || [];
        const currentIds = this.amenities.map((a: any) => a.amenityId || a.amenity?.id);
        const inputs = all.map((a: any) => ({ type: 'checkbox' as const, label: a.name, value: a.id, checked: currentIds.includes(a.id) }));
        const alert = await this.alertCtrl.create({
          header: 'Características', inputs,
          buttons: [
            { text: 'Cancelar', role: 'cancel' },
            { text: 'Guardar', handler: (selected: string[]) => {
              const toToggle = [...selected.filter(id => !currentIds.includes(id)), ...currentIds.filter((id: string) => !selected.includes(id))];
              let done = 0;
              if (!toToggle.length) return;
              for (const amenityId of toToggle) {
                this.http.post<any>(`${this.apiUrl}/amenities/toggle`, { barbershopId: this.bsId, amenityId })
                  .subscribe({ next: () => { done++; if (done === toToggle.length) { this.toast('Actualizado', 'success'); this.loadData(); } }, error: () => { done++; } });
              }
            }},
          ],
        });
        await alert.present();
      },
    });
  }

  // ── Configuración (igual que /admin/barbershop/:id) ───────────────────
  async editSettings(): Promise<void> {
    const bs = this.barbershop;
    const alert = await this.alertCtrl.create({
      header: 'Configuración',
      inputs: [
        { name: 'description',       type: 'textarea', placeholder: 'Descripción',       value: bs?.description || '' },
        { name: 'phone',             type: 'tel',      placeholder: 'Teléfono',          value: bs?.phone || '' },
        { name: 'depositAmount',     type: 'number',   placeholder: 'Monto seña',        value: bs?.depositAmount?.toString() || '0' },
        { name: 'cancellationHours', type: 'number',   placeholder: 'Hs cancelación',    value: bs?.cancellationHours?.toString() || '12' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (data) => {
          this.http.put<any>(`${this.apiUrl}/barbershops/${this.bsId}`, {
            description:       data.description || undefined,
            phone:             data.phone || undefined,
            depositAmount:     parseFloat(data.depositAmount) || 0,
            cancellationHours: parseInt(data.cancellationHours, 10) || 12,
          }).subscribe({ next: () => { this.toast('Configuración guardada', 'success'); this.loadData(); }, error: (e: any) => this.toast(e?.error?.error?.message || 'Error', 'danger') });
        }},
      ],
    });
    await alert.present();
  }

  // ── Subdominio ────────────────────────────────────────────────────────
  get currentSlug(): string {
    const slug = this.barbershop?.slug ?? '';
    return slug.startsWith('disabled-') ? '' : slug;
  }

  async manageSubdomain(): Promise<void> {
    const currentSlug = this.currentSlug;
    const alert = await this.alertCtrl.create({
      header: 'Gestionar subdominio',
      message: currentSlug ? `Subdominio actual: <strong>${currentSlug}</strong>` : 'Sin subdominio asignado.',
      inputs: [{ name: 'slug', type: 'text', placeholder: 'ej: barber-alem', value: currentSlug, attributes: { autocapitalize: 'none', autocorrect: 'off' } }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        ...(currentSlug ? [{ text: 'Eliminar', cssClass: 'alert-button-danger', handler: () => { this.setSlug(null); return true; } }] : []),
        { text: currentSlug ? 'Actualizar' : 'Asignar', handler: (data: any) => {
          const newSlug = data.slug?.trim().toLowerCase();
          if (!newSlug) { this.toast('Ingresá un slug', 'warning'); return false; }
          if (newSlug === currentSlug) return true;
          this.setSlug(newSlug);
          return true;
        }},
      ],
    });
    await alert.present();
  }

  private setSlug(slug: string | null): void {
    this.http.patch<any>(`${this.apiUrl}/barbershops/${this.bsId}/slug`, { slug }).subscribe({
      next: (res: any) => {
        if (this.barbershop) this.barbershop = { ...this.barbershop, slug: res.data?.slug ?? slug ?? '' };
        this.toast(slug ? `Subdominio actualizado: ${slug}` : 'Subdominio eliminado', 'success');
      },
      error: (e: any) => this.toast(e?.error?.error?.message ?? 'Error al actualizar subdominio', 'danger'),
    });
  }

  // ── Seña ──────────────────────────────────────────────────────────────
  openDepositManager(): void {
    this.depositTypeLocal   = this.barbershop?.depositType ?? 'FIXED';
    this.depositAmountLocal = this.barbershop?.depositAmount ?? 0;
    this.showDepositManager = true;
  }

  closeDepositManager(): void { this.showDepositManager = false; }

  get isComisionPlan(): boolean  { return this.currentPlan === 'COMISION'; }
  get isSuscripcionPlan(): boolean { return this.currentPlan === 'SUSCRIPCION'; }

  saveDeposit(): void {
    if (this.depositSaving) return;
    this.depositSaving = true;
    this.http.put<any>(`${this.apiUrl}/barbershops/${this.bsId}`, {
      depositAmount: this.depositAmountLocal,
      depositType:   this.depositTypeLocal,
    }).subscribe({
      next: () => {
        this.depositSaving = false;
        this.toast('Seña actualizada', 'success');
        this.loadData();
        this.closeDepositManager();
      },
      error: (e: any) => {
        this.depositSaving = false;
        this.toast(e?.error?.error?.message || 'Error al guardar', 'danger');
      },
    });
  }

  depositLabel(): string {
    return this.depositTypeLocal === 'PERCENTAGE' ? '% del servicio (ej: 30)' : 'Monto fijo ($)';
  }

  depositPreview(): string {
    if (!this.depositAmountLocal) return 'Sin seña';
    return this.depositTypeLocal === 'PERCENTAGE'
      ? `${this.depositAmountLocal}% del precio del servicio`
      : `$${this.depositAmountLocal.toLocaleString('es-AR')} fijos`;
  }

  // ── Toast ─────────────────────────────────────────────────────────────
  async toast(message: string, color = 'warning'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }
}
