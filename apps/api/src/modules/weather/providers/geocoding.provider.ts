import type { Place } from '@expense-tracker/types';

/** Names places on the map. Also an abstract class used as the DI token. */
export abstract class GeocodingProvider {
  /** "Belgrade, RS"; null when the place has no usable name. May throw. */
  abstract reverse(lat: number, lon: number): Promise<string | null>;

  /** Towns and cities matching `query`, best match first. May throw. */
  abstract search(query: string): Promise<Place[]>;
}
