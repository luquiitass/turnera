import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationsService, Notification } from '../../../../services/notifications.service';

const TYPE_ICON: Record<string, string> = {
  NOT_RESERVA_NUEVA:            'calendar-outline',
  NOT_RESERVA_CONFIRMADA:       'checkmark-circle-outline',
  NOT_RESERVA_CANCELADA:        'close-circle-outline',
  NOT_RESERVA_RECORDATORIO_24H: 'alarm-outline',
  NOT_RESERVA_RECORDATORIO_1H:  'alarm-outline',
  NOT_RESERVA_COMPLETADA:       'checkmark-done-outline',
  NOT_RESERVA_NO_SHOW:          'person-remove-outline',
  NOT_PAGO_SENA:                'cash-outline',
  NOT_PAGO_RECIBIDO:            'card-outline',
  NOT_OFERTA_NUEVA:             'pricetag-outline',
  NOT_BIENVENIDA:               'happy-outline',
  NOT_SISTEMA:                  'information-circle-outline',
};

const TYPE_COLOR: Record<string, string> = {
  NOT_RESERVA_NUEVA:            'primary',
  NOT_RESERVA_CONFIRMADA:       'success',
  NOT_RESERVA_CANCELADA:        'danger',
  NOT_RESERVA_RECORDATORIO_24H: 'warning',
  NOT_RESERVA_RECORDATORIO_1H:  'warning',
  NOT_RESERVA_COMPLETADA:       'success',
  NOT_RESERVA_NO_SHOW:          'danger',
  NOT_PAGO_SENA:                'tertiary',
  NOT_PAGO_RECIBIDO:            'success',
  NOT_OFERTA_NUEVA:             'tertiary',
  NOT_BIENVENIDA:               'primary',
  NOT_SISTEMA:                  'medium',
};

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage implements OnInit {
  notifications: Notification[] = [];
  loading = true;
  page = 1;
  totalPages = 1;
  markingAll = false;

  // DestroyRef used to scope the live-push subscription to this component's
  // lifetime (set up once in ngOnInit, cleaned up automatically on destroy).
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private notificationsService: NotificationsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Subscribe once to the SSE-driven notification stream.
    // New notifications are prepended to the list without a full reload.
    // Using ngOnInit (not ionViewWillEnter) ensures a single subscription
    // for the component's entire lifetime regardless of how many times the
    // user navigates away and back.
    this.notificationsService.notification$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(incoming => {
        // Guard against duplicates (e.g. page reloads that race with SSE push)
        if (!this.notifications.some(n => n.id === incoming.id)) {
          this.notifications = [incoming, ...this.notifications];
        }
      });
  }

  // ionViewWillEnter handles the initial load and any re-entry (user navigated
  // away and came back). The SSE subscription above handles real-time updates
  // between visits without any polling.
  ionViewWillEnter(): void {
    this.load();
  }

  load(reset = true): void {
    if (reset) { this.page = 1; this.notifications = []; }
    this.loading = true;
    this.notificationsService.getAll(this.page).subscribe({
      next: (res: any) => {
        const data = res.data ?? res;
        this.notifications = reset
          ? (data.data ?? [])
          : [...this.notifications, ...(data.data ?? [])];
        this.totalPages = data.totalPages ?? 1;
        this.loading = false;
        this.notificationsService.refreshCount();
      },
      error: () => { this.loading = false; },
    });
  }

  loadMore(): void {
    if (this.page >= this.totalPages) return;
    this.page++;
    this.load(false);
  }

  doRefresh(event: any): void {
    this.notificationsService.getAll(1).subscribe({
      next: (res: any) => {
        const data = res.data ?? res;
        this.notifications = data.data ?? [];
        this.totalPages = data.totalPages ?? 1;
        this.notificationsService.refreshCount();
        event.target.complete();
      },
      error: () => event.target.complete(),
    });
  }

  onTap(n: Notification): void {
    if (!n.isRead) {
      this.notificationsService.markRead(n.id).subscribe(() => {
        n.isRead = true;
        this.notificationsService.refreshCount();
      });
    }

    // CWE-601 (Open Redirect) mitigation: only navigate to validated
    // internal Angular routes. Server-supplied URLs are untrusted and must
    // not be forwarded to the router without validation.
    const url = n.extraData?.actionUrl ?? n.actionUrl;
    if (url && this.isSafeInternalRoute(url)) {
      this.router.navigateByUrl(url);
    }
  }

  markAllRead(): void {
    this.markingAll = true;
    this.notificationsService.markAllRead().subscribe({
      next: () => {
        this.notifications.forEach(n => (n.isRead = true));
        this.markingAll = false;
        this.notificationsService.refreshCount();
      },
      // Reset flag on error so the button is not permanently disabled
      error: () => { this.markingAll = false; },
    });
  }

  getIcon(type: string): string { return TYPE_ICON[type] ?? 'notifications-outline'; }
  getColor(type: string): string { return TYPE_COLOR[type] ?? 'medium'; }

  get unread(): number { return this.notifications.filter(n => !n.isRead).length; }

  formatDate(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `hace ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `hace ${diffD}d`;
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  /**
   * CWE-601 mitigation: validates that a URL is a safe internal Angular route.
   *
   * Accepted:  /tabs/notifications, /booking/123
   * Rejected:  https://evil.com, //evil.com, javascript:alert(1), http://...
   */
  private isSafeInternalRoute(url: string): boolean {
    if (typeof url !== 'string' || url.length === 0) return false;
    if (!url.startsWith('/')) return false;
    if (url.startsWith('//')) return false;
    // Reject any embedded scheme: javascript:, data:, http:, https:, etc.
    if (/[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) return false;
    return true;
  }
}
