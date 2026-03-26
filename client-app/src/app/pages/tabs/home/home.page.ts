import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  appName = environment.appName;
  apiUrl = environment.apiUrl;
  bsId = environment.barbershopId;

  barbershop: any = null;
  services: any[] = [];
  barbers: any[] = [];
  amenities: any[] = [];
  reviews: any[] = [];
  offers: any[] = [];

  loading = true;
  error = false;
  isAdmin = false;
  showAdminPanel = false;

  allGlobalServices: any[] = [];
  allGlobalAmenities: any[] = [];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private http: HttpClient,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ionViewWillEnter(): void {
    if (this.barbershop) this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = false;
    this.api.getBarbershop().subscribe({
      next: (res) => {
        const data = res.data ?? res;
        this.barbershop = data;
        this.services = data.services ?? [];
        this.barbers = (data.barbers ?? []).filter((b: any) => b.isActive);
        this.amenities = data.amenities ?? [];
        this.reviews = data.reviews ?? [];
        this.offers = (data.offers ?? []).filter((o: any) => o.isActive);
        this.loading = false;
        this.checkAdmin();
      },
      error: () => { this.error = true; this.loading = false; },
    });
  }

  doRefresh(event: any): void {
    this.api.getBarbershop().subscribe({
      next: (res) => {
        const data = res.data ?? res;
        this.barbershop = data;
        this.services = data.services ?? [];
        this.barbers = (data.barbers ?? []).filter((b: any) => b.isActive);
        this.amenities = data.amenities ?? [];
        this.reviews = data.reviews ?? [];
        this.offers = (data.offers ?? []).filter((o: any) => o.isActive);
        this.checkAdmin();
        event.target.complete();
      },
      error: () => { event.target.complete(); },
    });
  }

  checkAdmin(): void {
    if (!this.auth.isAuthenticated) { this.isAdmin = false; return; }
    this.api.getMyBarberProfile().subscribe({
      next: () => {}, error: () => {},
    });
    this.http.get<any>(`${this.apiUrl}/barbershops/admin/my-barbershops`).subscribe({
      next: (res: any) => {
        const myBs = Array.isArray(res.data) ? res.data : [];
        this.isAdmin = myBs.some((bs: any) => bs.id === this.bsId);
      },
      error: () => { this.isAdmin = false; },
    });
  }

  toggleAdminPanel(): void {
    this.showAdminPanel = !this.showAdminPanel;
  }

  goToBooking(): void {
    this.router.navigateByUrl('/booking');
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

  scheduleBarber: any = null;
  scheduleData: { day: string; label: string; enabled: boolean; openTime: string; closeTime: string }[] = [];
  showScheduleEditor = false;

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
  private offerDraft: any = {};

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
}
