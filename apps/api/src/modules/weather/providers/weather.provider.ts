import type { WeatherReading } from '../contracts';

/**
 * Where the weather comes from. An abstract class so it doubles as the DI
 * token: swap the source (or fake it in tests) by providing another one.
 */
export abstract class WeatherProvider {
  /**
   * Current conditions and the daily forecast at a point; throws when the
   * source fails.
   */
  abstract fetchCurrent(lat: number, lon: number): Promise<WeatherReading>;
}
