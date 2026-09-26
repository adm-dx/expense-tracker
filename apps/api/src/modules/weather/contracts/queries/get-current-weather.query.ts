/** Current weather at a point (`CurrentWeatherResult`). */
export class GetCurrentWeatherQuery {
  constructor(
    public readonly lat: number,
    public readonly lon: number
  ) {}
}
