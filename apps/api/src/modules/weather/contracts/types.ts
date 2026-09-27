import type { DailyForecast } from '@expense-tracker/types';

/** What the weather provider reports for one place. */
export interface WeatherReading {
  /** °C */
  temperature: number;
  /** WMO weather interpretation code. */
  weatherCode: number;
  isDay: boolean;
  observedAt: Date;
  /** Today and the next days; empty when the provider sent none. */
  forecast: DailyForecast[];
}

export interface CurrentWeatherResult extends WeatherReading {
  /** "Belgrade, RS"; null when the place could not be named. */
  location: string | null;
}
