import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

export interface SseEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

@Injectable()
export class SseManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(SseManagerService.name);

  /** userId → set of subjects (un usuario puede tener varias pestañas abiertas) */
  private readonly connections = new Map<string, Set<Subject<SseEvent>>>();

  // ── Conexión ────────────────────────────────────────────────────────────────

  /**
   * Crea un Observable SSE para el userId dado.
   * - Envía heartbeat cada 25s (comment ':\n\n') para mantener la conexión viva.
   * - Se limpia automáticamente cuando el cliente desconecta (observable completa).
   */
  connect(userId: string): Observable<SseEvent> {
    const subject = new Subject<SseEvent>();

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(subject);

    this.logger.log(`SSE connect: ${userId} (${this.connections.get(userId)!.size} tabs)`);

    return new Observable<SseEvent>(observer => {
      // Heartbeat cada 25s para evitar timeout de proxies/nginx
      const heartbeatSub = timer(0, 25_000).subscribe(() => {
        observer.next({ data: '', event: 'heartbeat' });
      });

      const sub = subject.subscribe(observer);

      return () => {
        sub.unsubscribe();
        heartbeatSub.unsubscribe();
        this.disconnect(userId, subject);
      };
    });
  }

  private disconnect(userId: string, subject: Subject<SseEvent>): void {
    const set = this.connections.get(userId);
    if (!set) return;
    set.delete(subject);
    if (set.size === 0) this.connections.delete(userId);
    this.logger.log(`SSE disconnect: ${userId} (${set.size} tabs left)`);
  }

  // ── Push ────────────────────────────────────────────────────────────────────

  /** Envía un evento `notification` a todas las pestañas del usuario. */
  pushNotification(userId: string, notification: object): void {
    this.emit(userId, { event: 'notification', data: JSON.stringify(notification) });
  }

  /** Envía el conteo de no leídas actualizado. */
  pushUnreadCount(userId: string, count: number): void {
    this.emit(userId, { event: 'unread-count', data: String(count) });
  }

  private emit(userId: string, event: SseEvent): void {
    const set = this.connections.get(userId);
    if (!set || set.size === 0) return;
    for (const subject of set) {
      subject.next(event);
    }
  }

  /** ¿Hay alguna conexión SSE activa para este usuario? */
  isConnected(userId: string): boolean {
    return (this.connections.get(userId)?.size ?? 0) > 0;
  }

  onModuleDestroy(): void {
    for (const [, set] of this.connections) {
      for (const subject of set) subject.complete();
    }
    this.connections.clear();
  }
}
