import { Injectable, DestroyRef } from '@angular/core';
import { Observable } from 'rxjs';

export interface SseMessage {
  /** SSE event name — defaults to 'message' if the server omits the event: field. */
  event: string;
  /** Raw data payload (may be multi-line, already joined with newlines). */
  data: string;
  /** Optional last-event-id for resumable streams. */
  id?: string;
}

/**
 * Low-level Server-Sent Events client built on fetch() + ReadableStream.
 *
 * Why fetch() instead of the native EventSource API:
 *   EventSource does NOT support custom HTTP headers, so any auth token
 *   would have to go in the URL query string — a CWE-598 violation that
 *   exposes credentials in server access logs and browser history.
 *   fetch() lets us send `Authorization: Bearer <token>` as a header.
 *
 * Features:
 *   - Proper SSE line parsing per RFC 8895 (event / data / id / retry fields,
 *     comment lines ignored).
 *   - Automatic reconnection with exponential back-off (1 s → 30 s cap).
 *   - Respects the server-sent `retry:` field to override the delay.
 *   - Stops automatically when the provided DestroyRef fires (no leaks).
 *   - Bails out on HTTP 401 so the caller can handle token expiry.
 */
@Injectable({ providedIn: 'root' })
export class SseService {

  /**
   * Opens a persistent SSE connection to `url`, emitting each parsed message.
   *
   * @param url       Full SSE endpoint URL.
   * @param headers   Headers to attach (include `Authorization: Bearer <token>`).
   * @param destroyRef Angular DestroyRef that cancels the stream on destruction.
   */
  connect(
    url: string,
    headers: Record<string, string>,
    destroyRef: DestroyRef,
  ): Observable<SseMessage> {
    return new Observable<SseMessage>(observer => {
      let active = true;

      // Cancel the stream when the owning component/service is destroyed
      destroyRef.onDestroy(() => {
        active = false;
        observer.complete();
      });

      const run = async (): Promise<void> => {
        let retryDelayMs = 1000;
        const MAX_RETRY_MS = 30_000;

        while (active) {
          const controller = new AbortController();

          // Stop the in-flight fetch immediately when destroyed
          const unregister = destroyRef.onDestroy(() => controller.abort());

          try {
            const response = await fetch(url, {
              headers: {
                ...headers,
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
              },
              signal: controller.signal,
            });

            if (response.status === 401) {
              // Auth token is invalid — surface the error and stop reconnecting.
              // The caller is responsible for handling session expiry.
              observer.error(new SseAuthError());
              return;
            }

            if (!response.ok || !response.body) {
              throw new Error(`SSE: unexpected HTTP ${response.status}`);
            }

            // Successful connection — reset back-off
            retryDelayMs = 1000;

            await this.readStream(response.body, observer, () => active, retryDelayMs);

          } catch (err: unknown) {
            if (!active) return;
            if (err instanceof SseAuthError) { observer.error(err); return; }
            // Network / server error — wait then reconnect
            await sleep(retryDelayMs);
            retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS);
          } finally {
            unregister();
          }
        }
      };

      run();

      // Teardown: mark inactive so the loop exits on next iteration
      return () => { active = false; };
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async readStream(
    body: ReadableStream<Uint8Array>,
    observer: { next: (v: SseMessage) => void },
    isActive: () => boolean,
    retryRef: number,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = 'message';
    let currentData = '';
    let currentId: string | undefined;

    try {
      while (isActive()) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on both \r\n and \n (SSE spec allows both)
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';   // last incomplete line stays buffered

        for (const line of lines) {
          if (line === '') {
            // Empty line = dispatch event
            if (currentData) {
              observer.next({ event: currentEvent, data: currentData, id: currentId });
            }
            currentEvent = 'message';
            currentData = '';
            currentId = undefined;

          } else if (line.startsWith(':')) {
            // Comment / heartbeat — ignore

          } else if (line.startsWith('event:')) {
            currentEvent = line.slice(6).replace(/^\s+/, '');

          } else if (line.startsWith('data:')) {
            const chunk = line.slice(5).replace(/^\s+/, '');
            currentData = currentData ? `${currentData}\n${chunk}` : chunk;

          } else if (line.startsWith('id:')) {
            currentId = line.slice(3).replace(/^\s+/, '');

          } else if (line.startsWith('retry:')) {
            const ms = parseInt(line.slice(6).replace(/^\s+/, ''), 10);
            if (!isNaN(ms)) retryRef = ms;
          }
        }
      }
    } finally {
      reader.cancel();
    }
  }
}

/** Signals that the SSE endpoint returned HTTP 401. */
export class SseAuthError extends Error {
  constructor() { super('SSE: Unauthorized'); }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
