import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './services/auth.service';
import { environment } from '../../environments/environment';

/** Minimal typed surface of the OneSignal SDK used by this service. */
interface OneSignalInstance {
  Notifications: {
    requestPermission(): Promise<void>;
  };
  User: {
    PushSubscription: {
      id?: string | null;
      addEventListener(event: 'change', handler: (event: OneSignalSubscriptionChangeEvent) => void): void;
    };
  };
}

interface OneSignalSubscriptionChangeEvent {
  current?: { id?: string | null };
}

/**
 * Augment the global Window interface so TypeScript knows about OneSignal's
 * deferred loader without overriding the entire Window type with `any`.
 */
declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalInstance) => Promise<void>>;
  }
}

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly url = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  init(): void {
    if (!window.OneSignalDeferred) return;

    window.OneSignalDeferred.push(async (OneSignal: OneSignalInstance) => {
      // Listen for subscription changes and register the new token
      OneSignal.User.PushSubscription.addEventListener('change', (event: OneSignalSubscriptionChangeEvent) => {
        const token = event?.current?.id;
        if (token && this.auth.isAuthenticated) {
          this.registerToken(token);
        }
      });

      // If the user already has a push subscription, register it immediately
      const sub = OneSignal.User.PushSubscription;
      if (sub?.id && this.auth.isAuthenticated) {
        this.registerToken(sub.id);
      }
    });
  }

  requestPermission(): void {
    if (!window.OneSignalDeferred) return;
    window.OneSignalDeferred.push(async (OneSignal: OneSignalInstance) => {
      await OneSignal.Notifications.requestPermission();
    });
  }

  private registerToken(token: string): void {
    this.http.patch(`${this.url}/push-token`, { token }).subscribe({ error: () => {} });
  }
}
