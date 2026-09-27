import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Place } from '@expense-tracker/types';
import { GeocodingProvider } from './geocoding.provider';

export const DEFAULT_GEOCODING_URL = 'https://nominatim.openstreetmap.org';
// Nominatim's usage policy asks for an identifying User-Agent.
export const GEOCODING_USER_AGENT =
  'expense-tracker/0.1 (+https://github.com/adm-dx/expense-tracker)';
const TIMEOUT_MS = 5000;
/** Nominatim allows at most one request a second per application. */
export const MIN_REQUEST_INTERVAL_MS = 1000;
/** How many places `search` asks for. */
export const MAX_SEARCH_RESULTS = 5;

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

interface NominatimResponse {
  error?: string;
  address?: NominatimAddress;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

/** "Belgrade, RS": the most specific settlement name plus the country code. */
function formatPlaceName(address: NominatimAddress): string | null {
  const place =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    address.state ??
    address.country;
  if (!place) return null;
  const country = address.country_code?.toUpperCase();
  return country && place !== address.country
    ? `${place}, ${country}`
    : place;
}

/**
 * OpenStreetMap Nominatim geocoding
 * (https://operations.osmfoundation.org/policies/nominatim/): no key, at most
 * one request a second, results must be cached, no autocomplete, attribution
 * in the UI. The weather service caches names and searches for a day to stay
 * well inside that.
 */
@Injectable()
export class NominatimProvider extends GeocodingProvider {
  private readonly baseUrl: string;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = Number.NEGATIVE_INFINITY;

  constructor(configService: ConfigService) {
    super();
    this.baseUrl =
      configService.get<string>('GEOCODING_URL') ?? DEFAULT_GEOCODING_URL;
  }

  reverse(lat: number, lon: number): Promise<string | null> {
    return this.throttled(() => this.request(lat, lon));
  }

  search(query: string): Promise<Place[]> {
    return this.throttled(() => this.requestSearch(query));
  }

  /** Runs requests one at a time, at least a second apart. */
  private throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastRequestAt = Date.now();
      return task();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async request(lat: number, lon: number): Promise<string | null> {
    const query = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lon),
      // City level: no street addresses.
      zoom: '10',
      'accept-language': 'en',
    });
    const response = await fetch(`${this.baseUrl}/reverse?${query}`, {
      headers: { 'User-Agent': GEOCODING_USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Geocoding request failed: HTTP ${response.status}`);
    }
    const { address, error } = (await response.json()) as NominatimResponse;
    // "Unable to geocode": open sea and the like.
    if (error || !address) return null;
    return formatPlaceName(address);
  }

  private async requestSearch(query: string): Promise<Place[]> {
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: query,
      // Towns and cities only: no streets, shops or addresses.
      featureType: 'settlement',
      addressdetails: '1',
      limit: String(MAX_SEARCH_RESULTS),
      'accept-language': 'en',
    });
    const response = await fetch(`${this.baseUrl}/search?${params}`, {
      headers: { 'User-Agent': GEOCODING_USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Geocoding search failed: HTTP ${response.status}`);
    }
    const results = (await response.json()) as NominatimSearchResult[];

    const places: Place[] = [];
    for (const result of results) {
      const name = result.address ? formatPlaceName(result.address) : null;
      const lat = Number(result.lat);
      const lon = Number(result.lon);
      // Several OSM objects can stand for one town: keep the first.
      if (
        !name ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        places.some((place) => place.name === name)
      ) {
        continue;
      }
      places.push({ name, lat, lon });
    }
    return places;
  }
}
