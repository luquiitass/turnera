import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  country?: string;
}

export interface AddressAutocompleteResult {
  address: string;
  lat: number;
  lng: number;
  city?: string;
}

@Injectable()
export class GeocodingService {
  private readonly nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
  private readonly timeout = 5000;
  private readonly cache = new Map<string, AddressAutocompleteResult[]>();
  private readonly cacheExpiry = 3600000; // 1 hora en ms

  /**
   * Convierte una dirección a coordenadas (lat/lng)
   */
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    if (!address || address.trim().length === 0) {
      throw new BadRequestException('Dirección no puede estar vacía');
    }

    try {
      const searchAddress = this.enrichAddress(address);
      console.log('🔍 Geocodificando:', searchAddress);
      
      const response = await axios.get(
        `${this.nominatimBaseUrl}/search`,
        {
          params: {
            q: searchAddress,
            format: 'json',
            limit: 1,
          },
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Turnera-Barbershop-App/1.0',
          },
        },
      );

      if (!response.data || response.data.length === 0) {
        throw new BadRequestException(
          'No se encontró la dirección. Intenta con una dirección más específica.',
        );
      }

      const result = response.data[0];

      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: result.display_name,
        city: result.address?.city || result.address?.town,
        country: result.address?.country,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('❌ Error en geocodeAddress:', error);
      throw new BadRequestException(
        'Error al geocodificar la dirección. Intenta de nuevo.',
      );
    }
  }

  /**
   * Autocompletado de direcciones (busca mientras escribe)
   * Implementa cache para evitar rate limiting
   */
  async autocompleteAddress(query: string): Promise<AddressAutocompleteResult[]> {
    if (!query || query.trim().length < 3) {
      return [];
    }

    const cacheKey = query.toLowerCase();

    // Verificar cache
    if (this.cache.has(cacheKey)) {
      console.log('📦 Resultado desde cache:', cacheKey);
      return this.cache.get(cacheKey) || [];
    }

    try {
      const searchQuery = this.enrichAddress(query);
      console.log('🌐 Llamando Nominatim:', searchQuery);
      
      const response = await axios.get(
        `${this.nominatimBaseUrl}/search`,
        {
          params: {
            q: searchQuery,
            format: 'json',
            limit: 5,
          },
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Turnera-Barbershop-App/1.0',
          },
        },
      );

      console.log('✅ Resultados encontrados:', response.data?.length || 0);

      const results = (response.data || []).map((result) => ({
        address: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        city: result.address?.city || result.address?.town,
      }));

      // Guardar en cache
      this.cache.set(cacheKey, results);
      
      // Limpiar cache después de 1 hora
      setTimeout(() => {
        this.cache.delete(cacheKey);
        console.log('🗑️ Cache expirado:', cacheKey);
      }, this.cacheExpiry);

      return results;
    } catch (error) {
      console.error('❌ Error en autocompleteAddress:', error);
      return [];
    }
  }

  /**
   * Enriquece la dirección con contexto de Argentina
   */
  private enrichAddress(address: string): string {
    const query = address.trim().toLowerCase();
    
    // Si ya tiene "argentina" o "buenos aires", no agregar nada
    if (query.includes('argentina') || query.includes('buenos aires')) {
      return address;
    }
    
    // Si es solo una dirección (Av., Calle, etc), agregar Buenos Aires
    if (query.match(/^(av\.|avenida|calle|str|saint|pje\.)/i)) {
      return `${address}, Buenos Aires, Argentina`;
    }
    
    // Si parece una dirección con número, agregar Buenos Aires
    if (query.match(/\d+\s*$/)) {
      return `${address}, Buenos Aires, Argentina`;
    }
    
    // Por defecto, agregar Argentina
    return `${address}, Argentina`;
  }

  /**
   * Geocodificación inversa: convierte lat/lng a dirección
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    if (!lat || !lng) {
      throw new BadRequestException('Latitud y Longitud requeridas');
    }

    try {
      const response = await axios.get(
        `${this.nominatimBaseUrl}/reverse`,
        {
          params: {
            lat,
            lon: lng,
            format: 'json',
          },
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Turnera-Barbershop-App/1.0',
          },
        },
      );

      if (!response.data) {
        throw new BadRequestException(
          'No se encontró dirección para estas coordenadas',
        );
      }

      return {
        lat,
        lng,
        formattedAddress: response.data.display_name,
        city: response.data.address?.city || response.data.address?.town,
        country: response.data.address?.country,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('❌ Error en reverseGeocode:', error);
      throw new BadRequestException('Error al geocodificar inverso');
    }
  }

  /**
   * Calcula distancia en km entre dos puntos (Haversine)
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
