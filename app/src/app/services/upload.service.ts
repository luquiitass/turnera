import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap, map, filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Image, ImageType } from '../shared/models';

export interface UploadEvent {
  progress: number;   // 0–100
  image?: Image;      // presente solo cuando progress === 100
}

const MAX_DIMENSIONS: Record<ImageType, [number, number]> = {
  ICONO:   [400,  400],
  PORTADA: [1920, 1080],
  PERFIL:  [800,  800],
  GALERIA: [1200, 900],
};

@Injectable({ providedIn: 'root' })
export class UploadService {
  private url = `${environment.apiUrl}/upload`;

  constructor(private http: HttpClient) {}

  uploadImage(file: File, type: ImageType, name?: string): Observable<UploadEvent> {
    return from(this.compress(file, type)).pipe(
      switchMap((compressed) => {
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('type', type);
        if (name) formData.append('name', name);

        const req = new HttpRequest('POST', `${this.url}/image`, formData, {
          reportProgress: true,
        });

        return this.http.request<{ data: Image }>(req).pipe(
          filter((e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
          map((e) => {
            if (e.type === HttpEventType.UploadProgress) {
              const progress = e.total ? Math.round(100 * e.loaded / e.total) : 0;
              return { progress: Math.min(progress, 99) };
            }
            // Response
            const body = (e as any).body as { data: Image };
            return { progress: 100, image: body.data };
          }),
        );
      }),
    );
  }

  private compress(file: File, type: ImageType): Promise<File> {
    const [maxW, maxH] = MAX_DIMENSIONS[type];
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          let { width, height } = img;

          // Solo redimensiona si supera el máximo
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width  = Math.round(width  * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width  = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error('Compresión fallida')); return; }
              // Si el comprimido pesa más que el original, devuelve el original
              const result = blob.size < file.size
                ? new File([blob], file.name, { type: 'image/jpeg' })
                : file;
              resolve(result);
            },
            'image/jpeg',
            0.87,
          );
        };
        img.onerror = reject;
        img.src = e.target!.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
