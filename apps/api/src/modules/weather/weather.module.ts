import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GetCurrentWeatherHandler } from './handlers/get-current-weather.handler';
import { GeocodingProvider } from './providers/geocoding.provider';
import { NominatimProvider } from './providers/nominatim.provider';
import { OpenMeteoProvider } from './providers/open-meteo.provider';
import { WeatherProvider } from './providers/weather.provider';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';

@Module({
  imports: [CqrsModule],
  controllers: [WeatherController],
  providers: [
    { provide: WeatherProvider, useClass: OpenMeteoProvider },
    { provide: GeocodingProvider, useClass: NominatimProvider },
    WeatherService,
    GetCurrentWeatherHandler,
  ],
})
export class WeatherModule {}
