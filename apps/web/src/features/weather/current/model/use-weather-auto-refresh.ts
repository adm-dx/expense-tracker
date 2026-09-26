import { useEffect } from 'react';
import { useWeatherStore } from '@/entities/weather';
import { onGeolocationPermissionChange } from '@/shared/lib/geolocation';

export const WEATHER_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function isStale(): boolean {
  const { updatedAt } = useWeatherStore.getState();
  return (
    updatedAt === null || Date.now() - updatedAt >= WEATHER_REFRESH_INTERVAL_MS
  );
}

/**
 * Loads the weather when mounted (the user opens the app), then every hour.
 * Browsers throttle timers in background tabs, so a tab that comes back to
 * the front with hour-old weather refreshes right away. Granting or revoking
 * location access in the browser takes effect without a reload.
 */
export function useWeatherAutoRefresh(): void {
  const refresh = useWeatherStore((state) => state.refresh);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, WEATHER_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isStale()) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const unwatchPermission = onGeolocationPermissionChange(() => {
      void refresh();
    });

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unwatchPermission();
    };
  }, [refresh]);
}
