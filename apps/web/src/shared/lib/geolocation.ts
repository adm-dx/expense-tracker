export interface Coordinates {
  lat: number;
  lon: number;
}

/** A position up to an hour old is good enough for the weather. */
export const POSITION_MAX_AGE_MS = 60 * 60 * 1000;
export const POSITION_TIMEOUT_MS = 10 * 1000;

/** Two decimals ≈ 1.1 km: enough for the weather, not a street address. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The browser's idea of where the user is, rounded to about a kilometre.
 * Asks for permission the first time. Resolves to null when the user says no,
 * the browser has no geolocation, or it can't find a position in time.
 */
export function getApproximatePosition(): Promise<Coordinates | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          lat: roundCoordinate(coords.latitude),
          lon: roundCoordinate(coords.longitude),
        }),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: POSITION_MAX_AGE_MS,
        timeout: POSITION_TIMEOUT_MS,
      }
    );
  });
}

/**
 * Calls `listener` when the user grants or revokes location access in the
 * browser's site settings. A no-op where the Permissions API is missing.
 * Returns the unsubscribe function.
 */
export function onGeolocationPermissionChange(
  listener: (state: PermissionState) => void
): () => void {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return () => {};
  }
  let status: PermissionStatus | null = null;
  let unsubscribed = false;
  const handleChange = () => {
    if (status) listener(status.state);
  };

  navigator.permissions
    .query({ name: 'geolocation' })
    .then((result) => {
      if (unsubscribed) return;
      status = result;
      status.addEventListener('change', handleChange);
    })
    .catch(() => {
      // Some browsers can't query geolocation; nothing to watch then.
    });

  return () => {
    unsubscribed = true;
    status?.removeEventListener('change', handleChange);
  };
}
