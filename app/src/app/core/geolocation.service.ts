import { Injectable } from '@angular/core';

export interface Location {
  latitude: number;
  longitude: number;
}

@Injectable({
  providedIn: 'root',
})
export class GeolocationService {
  private readonly storageKey = 'user_location';

  constructor() {}

  /**
   * Obtener ubicación actual (web API estándar)
   */
  async getCurrentLocation(skipStorage = false): Promise<Location | null> {
    try {
      // Verificar si ya tenemos ubicación guardada
      if (!skipStorage) {
        const stored = this.getStoredLocation();
        if (stored) {
          return stored;
        }
      }

      // Usar Geolocation API del navegador
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location: Location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            this.saveLocation(location);
            resolve(location);
          },
          (error) => {
            console.warn('Error obteniendo ubicación:', error);
            resolve(null);
          }
        );
      });
    } catch (error) {
      console.error('Error al obtener ubicación:', error);
      return null;
    }
  }

  /**
   * Obtener ubicación guardada en localStorage
   */
  getStoredLocation(): Location | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error al leer ubicación guardada:', error);
    }
    return null;
  }

  /**
   * Guardar ubicación en localStorage
   */
  saveLocation(location: Location): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(location));
    } catch (error) {
      console.error('Error al guardar ubicación:', error);
    }
  }

  /**
   * Limpiar ubicación guardada
   */
  clearLocation(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error al limpiar ubicación:', error);
    }
  }

  /**
   * Verificar si hay ubicación disponible
   */
  hasLocation(): boolean {
    return this.getStoredLocation() !== null;
  }
}
