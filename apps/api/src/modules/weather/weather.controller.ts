import { Controller, Get, Query } from '@nestjs/common';
import type { Place } from '@expense-tracker/types';
import type { CurrentWeatherResult } from './contracts';
import { CurrentWeatherQuery } from './dto/current-weather.query';
import { SearchPlacesQuery } from './dto/search-places.query';
import { WeatherService } from './weather.service';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  get(@Query() query: CurrentWeatherQuery): Promise<CurrentWeatherResult> {
    return this.weatherService.getCurrent(query.lat, query.lon);
  }

  /** Finds a town by name, for the location setting. */
  @Get('places')
  searchPlaces(@Query() query: SearchPlacesQuery): Promise<Place[]> {
    return this.weatherService.searchPlaces(query.q);
  }
}
