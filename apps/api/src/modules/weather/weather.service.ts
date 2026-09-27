import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Place } from '@expense-tracker/types';
import type { CurrentWeatherResult, WeatherReading } from './contracts';
import { GeocodingProvider } from './providers/geocoding.provider';
import { WeatherProvider } from './providers/weather.provider';

/** Weather changes slowly; Open-Meteo itself updates every 15 minutes. */
export const WEATHER_TTL_MS = 30 * 60 * 1000;
/**
 * A refresh asked for by the user skips the cache only once the reading is
 * this old: the button can't be used to hammer Open-Meteo, which itself
 * updates every 15 minutes.
 */
export const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** Last good weather is served for this long while the provider is down. */
export const STALE_WEATHER_MAX_AGE_MS = 3 * 60 * 60 * 1000;
/** Place names barely ever change; Nominatim asks for caching. */
export const LOCATION_TTL_MS = 24 * 60 * 60 * 1000;
/** A failed lookup is retried after this long, not on every request. */
export const LOCATION_RETRY_MS = 30 * 60 * 1000;
/** Search results for a place name; they change as rarely as the names. */
export const PLACES_TTL_MS = LOCATION_TTL_MS;
/** Per cache; the oldest entry is dropped beyond this. */
export const MAX_CACHE_ENTRIES = 500;

/** Two decimals ≈ 1.1 km: one cache entry per neighbourhood. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

interface CacheEntry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

/** A Map in insertion order doubles as the eviction queue. */
class BoundedCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  get(key: string): CacheEntry<T> | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: T, ttlMs: number, now: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, storedAt: now, expiresAt: now + ttlMs });
    if (this.entries.size > MAX_CACHE_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }
}

/**
 * Current weather and forecast plus a place name for a point, cached per rounded
 * coordinates. When the weather provider is down, recent weather is served;
 * when geocoding fails, the weather comes without a name.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly weather = new BoundedCache<WeatherReading>();
  private readonly locations = new BoundedCache<string | null>();
  private readonly places = new BoundedCache<Place[]>();
  private readonly inFlight = new Map<string, Promise<CurrentWeatherResult>>();

  constructor(
    private readonly weatherProvider: WeatherProvider,
    private readonly geocodingProvider: GeocodingProvider
  ) {}

  /**
   * `refresh` asks the provider again unless the cached reading is younger
   * than `MIN_REFRESH_INTERVAL_MS`; the place name stays cached either way.
   */
  getCurrent(
    lat: number,
    lon: number,
    { refresh = false }: { refresh?: boolean } = {}
  ): Promise<CurrentWeatherResult> {
    // Rounded here too: the client is expected to round, but not trusted to.
    const roundedLat = roundCoordinate(lat);
    const roundedLon = roundCoordinate(lon);
    const key = `${roundedLat},${roundedLon}`;

    // Concurrent callers for one place share one request.
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.load(key, roundedLat, roundedLon, refresh).finally(() => {
        this.inFlight.delete(key);
      });
      this.inFlight.set(key, pending);
    }
    return pending;
  }

  /**
   * Towns and cities matching `query`, cached per normalized query: Nominatim
   * asks for caching and allows one request a second for the whole app.
   */
  async searchPlaces(query: string): Promise<Place[]> {
    const key = query.trim().replace(/\s+/g, ' ').toLowerCase();
    const cached = this.places.get(key);
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    try {
      const places = await this.geocodingProvider.search(key);
      this.places.set(key, places, PLACES_TTL_MS, Date.now());
      return places;
    } catch (error) {
      this.logger.error(`Place search failed for "${key}": ${reason(error)}`);
      throw new ServiceUnavailableException('Place search is unavailable');
    }
  }

  private async load(
    key: string,
    lat: number,
    lon: number,
    refresh: boolean
  ): Promise<CurrentWeatherResult> {
    const [reading, location] = await Promise.all([
      this.getReading(key, lat, lon, refresh),
      this.getLocation(key, lat, lon),
    ]);
    return { ...reading, location };
  }

  private async getReading(
    key: string,
    lat: number,
    lon: number,
    refresh: boolean
  ): Promise<WeatherReading> {
    const cached = this.weather.get(key);
    const now = Date.now();
    const refreshing =
      refresh && cached && now - cached.storedAt >= MIN_REFRESH_INTERVAL_MS;
    if (cached && now < cached.expiresAt && !refreshing) return cached.value;

    try {
      const reading = await this.weatherProvider.fetchCurrent(lat, lon);
      this.weather.set(key, reading, WEATHER_TTL_MS, Date.now());
      return reading;
    } catch (error) {
      if (cached && Date.now() - cached.storedAt < STALE_WEATHER_MAX_AGE_MS) {
        this.logger.warn(
          `Serving weather for ${key} from ${new Date(cached.storedAt).toISOString()}: ${reason(error)}`
        );
        return cached.value;
      }
      this.logger.error(`Weather is unavailable for ${key}: ${reason(error)}`);
      throw new ServiceUnavailableException('Weather is unavailable');
    }
  }

  private async getLocation(
    key: string,
    lat: number,
    lon: number
  ): Promise<string | null> {
    const cached = this.locations.get(key);
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    try {
      const name = await this.geocodingProvider.reverse(lat, lon);
      this.locations.set(key, name, LOCATION_TTL_MS, Date.now());
      return name;
    } catch (error) {
      this.logger.warn(`Could not name ${key}: ${reason(error)}`);
      // A name we once had beats none; either way, back off before retrying.
      const fallback = cached?.value ?? null;
      this.locations.set(key, fallback, LOCATION_RETRY_MS, Date.now());
      return fallback;
    }
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
