import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    // SSE endpoints deben bypassear el wrapper — devuelven MessageEvent[], no JSON plano
    const res = context.switchToHttp().getResponse();
    const req = context.switchToHttp().getRequest();
    if (req?.url?.includes('/stream') || res?.getHeader?.('Content-Type') === 'text/event-stream') {
      return next.handle() as any;
    }
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
