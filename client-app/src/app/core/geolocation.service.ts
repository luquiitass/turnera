import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

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
   * Solicitar permiso y obtener ubicación actual
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

      // Solicitar permiso y obtener ubicación
      const coordinates = await Geolocation.getCurrentPosition();

      const location: Location = {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
      };

      // Guardar en localStorage
      this.saveLocation(location);

      return location;
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
