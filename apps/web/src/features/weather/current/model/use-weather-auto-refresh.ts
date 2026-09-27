import { useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/entities/settings';
import { useWeatherStore } from '@/entities/weather';
import {
  onGeolocationPermissionChange,
  type Coordinates,
} from '@/shared/lib/geolocation';

export const WEATHER_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function isStale(): boolean {
  const { updatedAt } = useWeatherStore.getState();
  return (
    updatedAt === null || Date.now() - updatedAt >= WEATHER_REFRESH_INTERVAL_MS
  );
}

/**
 * Where to show the weather for: the place chosen in the settings, or null
 * for the browser's position. Undefined while the settings are loading, so
 * the browser isn't asked for a position the user may have replaced.
 */
function useChosenPlace(): Coordinates | null | undefined {
  const location = useSettingsStore((state) => state.settings?.location);
  const settingsFailed = useSettingsStore((state) => state.status === 'error');
  const lat = location?.mode === 'manual' ? location.lat : null;
  const lon = location?.mode === 'manual' ? location.lon : null;

  if (!location) return settingsFailed ? null : undefined;
  return lat !== null && lon !== null ? { lat, lon } : null;
}

/**
 * Loads the weather when mounted (the user opens the app), then every hour,
 * for the place from the settings or else the browser's position. Browsers
 * throttle timers in background tabs, so a tab that comes back to the front
 * with hour-old weather refreshes right away. Granting or revoking location
 * access, or choosing another place, takes effect without a reload.
 *
 * Returns a function that loads it right now for the same place, past the
 * server's cache (a no-op while the settings are loading).
 */
export function useWeatherAutoRefresh(): () => void {
  const refresh = useWeatherStore((state) => state.refresh);
  const place = useChosenPlace();
  const waiting = place === undefined;
  const lat = place?.lat ?? null;
  const lon = place?.lon ?? null;

  const load = useCallback(
    (force = false) => {
      if (waiting) return;
      void refresh(lat !== null && lon !== null ? { lat, lon } : undefined, {
        force,
      });
    },
    [refresh, waiting, lat, lon]
  );

  useEffect(() => {
    if (waiting) return;
    // Never forced; also keeps listener arguments out of `force`.
    const autoLoad = () => load();

    autoLoad();
    const interval = setInterval(autoLoad, WEATHER_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isStale()) autoLoad();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Only the browser's position depends on the permission.
    const unwatchPermission =
      lat === null ? onGeolocationPermissionChange(autoLoad) : () => {};

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unwatchPermission();
    };
  }, [load, waiting, lat]);

  return useCallback(() => load(true), [load]);
}
