import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CurrentWeatherResult, GetCurrentWeatherQuery } from '../contracts';
import { WeatherService } from '../weather.service';

@QueryHandler(GetCurrentWeatherQuery)
export class GetCurrentWeatherHandler implements IQueryHandler<
  GetCurrentWeatherQuery,
  CurrentWeatherResult
> {
  constructor(private readonly weatherService: WeatherService) {}

  execute({ lat, lon }: GetCurrentWeatherQuery): Promise<CurrentWeatherResult> {
    return this.weatherService.getCurrent(lat, lon);
  }
}
