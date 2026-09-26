/** What the weather provider reports for one place. */
export interface WeatherReading {
  /** °C */
  temperature: number;
  /** WMO weather interpretation code. */
  weatherCode: number;
  isDay: boolean;
  observedAt: Date;
}

export interface CurrentWeatherResult extends WeatherReading {
  /** "Belgrade, RS"; null when the place could not be named. */
  location: string | null;
}
