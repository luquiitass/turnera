import { Controller, Post, Get, Body, Query, BadRequestException, Response } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { Public } from '../../common/decorators/public.decorator';

export class ValidateAddressDto {
  address: string;
}

@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Post('validate-address')
  @Public()
  async validateAddress(@Body() dto: ValidateAddressDto) {
    return this.geocodingService.geocodeAddress(dto.address);
  }

  @Get('autocomplete')
  @Public()
  async autocompleteAddress(@Query('query') query: string) {
    if (!query) {
      throw new BadRequestException('Query es requerido');
    }
    return this.geocodingService.autocompleteAddress(query);
  }

  @Get('autocomplete-raw')
  @Public()
  async autocompleteAddressRaw(@Query('query') query: string, @Response() res: any) {
    if (!query) {
      throw new BadRequestException('Query es requerido');
    }
    
    const results = await this.geocodingService.autocompleteAddress(query);
    
    // Retornar directamente sin envelope
    res.setHeader('Content-Type', 'application/json');
    res.send(results);
  }

  @Post('reverse')
  @Public()
  async reverseGeocode(@Body() body: { lat: number; lng: number }) {
    return this.geocodingService.reverseGeocode(body.lat, body.lng);
  }
}
