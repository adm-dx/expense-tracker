/** Names a point on the map. Also an abstract class used as the DI token. */
export abstract class GeocodingProvider {
  /** "Belgrade, RS"; null when the place has no usable name. May throw. */
  abstract reverse(lat: number, lon: number): Promise<string | null>;
}
