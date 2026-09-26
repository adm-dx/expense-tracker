import { Controller, Get, Query } from '@nestjs/common';
import type { CurrentWeatherResult } from './contracts';
import { CurrentWeatherQuery } from './dto/current-weather.query';
import { WeatherService } from './weather.service';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  get(@Query() query: CurrentWeatherQuery): Promise<CurrentWeatherResult> {
    return this.weatherService.getCurrent(query.lat, query.lon);
  }
}
