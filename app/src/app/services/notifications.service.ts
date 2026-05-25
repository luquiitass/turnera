import { Injectable, DestroyRef } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, Subject, interval, of } from 'rxjs';
import { switchMap, startWith, map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SseService, SseAuthError } from '../core/sse.service';
import { AuthService } from '../core/services/auth.service';

/** Typed shape for the extraData field on a notification. */
export interface NotificationExtraData {
  actionUrl?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId?: string;
  sender?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  title: string;
  body: string;
  type: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  priority: string;
  /** Arbitrary server metadata — typed as a plain record to avoid silent `any` access. */
  metadata?: Record<string, unknown>;
  /** Extra data attached by the server (e.g. actionUrl override). */
  extraData?: NotificationExtraData;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly url = `${environment.apiUrl}/notifications`;

  /** Current unread notification count — consumed by the tab badge. */
  readonly unreadCount$ = new BehaviorSubject<number>(0);

  /**
   * Emits each notification pushed in real-time by the SSE stream.
   * Subscribe in any page that wants live updates without polling.
   */
  readonly notification$ = new Subject<Notification>();

  constructor(
    private http: HttpClient,
    private sse: SseService,
    private auth: AuthService,
  ) {}

  // ─── Real-time connection ───────────────────────────────────────────────────

  /**
   * Opens a persistent SSE connection to the notification stream.
   *
   * On each incoming `notification` event:
   *   - Emits the parsed Notification via `notification$`.
   *   - Refreshes the unread count badge.
   *
   * On `unread-count` events (optional server-side optimisation):
   *   - Updates `unreadCount$` directly, skipping an extra HTTP round-trip.
   *
   * On 401: falls back transparently to polling so the UI never goes dark
   * while the user's session is being refreshed elsewhere.
   *
   * The connection is bound to `destroyRef` and will be closed automatically
   * when the owning component is destroyed.
   *
   * Security: the JWT is sent in the `Authorization` header, never in the URL
   * (avoids CWE-598 — token exposure in server logs / browser history).
   */
  startSse(destroyRef: DestroyRef): void {
    const token = this.auth.accessToken;
    if (!token) return;

    this.sse.connect(
      `${this.url}/stream`,
      { Authorization: `Bearer ${token}` },
      destroyRef,
    ).subscribe({
      next: msg => {
        if (msg.event === 'notification') {
          try {
            const notification = JSON.parse(msg.data) as Notification;
            this.notification$.next(notification);
            this.refreshCount();
          } catch {
            // Malformed JSON from server — ignore silently
          }
        } else if (msg.event === 'unread-count') {
          const count = parseInt(msg.data, 10);
          if (!isNaN(count)) this.unreadCount$.next(count);
        }
      },
      error: err => {
        // 401: token expired — fall back to polling.
        // Other SSE errors already use internal reconnection, so they never
        // surface here under normal conditions.
        if (err instanceof SseAuthError) {
          this.startPolling(destroyRef);
        }
      },
    });
  }

  /**
   * Fallback polling — used when SSE is not available or the endpoint returns 401.
   * Also retained for environments (e.g. some proxies) that do not support
   * long-lived HTTP connections.
   *
   * Lifecycle is bound to `destroyRef` — no cleanup needed by the caller.
   */
  startPolling(destroyRef: DestroyRef, intervalMs = 30_000): void {
    interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.fetchUnreadCount()),
      takeUntilDestroyed(destroyRef),
    ).subscribe({
      next: (count: number) => this.unreadCount$.next(count),
    });
  }

  // ─── HTTP helpers ───────────────────────────────────────────────────────────

  /**
   * Returns an Observable<number> of the current unread count.
   * Uses pipe(map, catchError) — avoids the `new Observable` wrapper anti-pattern
   * that can leave inner subscriptions uncleaned on error.
   */
  fetchUnreadCount(): Observable<number> {
    return this.http.get<any>(`${this.url}/unread-count`).pipe(
      map((r): number => r.data?.count ?? r.count ?? 0),
      catchError(() => of(0)),
    );
  }

  getAll(page = 1, limit = 20, unreadOnly = false) {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (unreadOnly) params = params.set('unreadOnly', 'true');
    return this.http.get<any>(this.url, { params });
  }

  markRead(id: string) {
    return this.http.patch(`${this.url}/${id}/read`, {});
  }

  markAllRead() {
    return this.http.patch(`${this.url}/read-all`, {});
  }

  getPreferences() {
    return this.http.get<any>(`${this.url}/preferences`);
  }

  updatePreference(
    type: string,
    data: { inApp?: boolean; push?: boolean; whatsapp?: boolean; email?: boolean },
  ) {
    return this.http.patch(`${this.url}/preferences`, { type, ...data });
  }

  refreshCount(): void {
    this.fetchUnreadCount().subscribe((count: number) => this.unreadCount$.next(count));
  }
}
