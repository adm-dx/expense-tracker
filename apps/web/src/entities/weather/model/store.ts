import type { CurrentWeather } from '@expense-tracker/types';
import { create } from 'zustand';
import { weatherApi } from '@/shared/api/weather-api';
import { getErrorMessage } from '@/shared/lib/error';
import { getApproximatePosition } from '@/shared/lib/geolocation';
import { registerStoreReset } from '@/shared/lib/store-reset';

/**
 * `unavailable`: no position (location access denied, unsupported or timed
 * out). `error`: the position is known but the weather request failed.
 */
export type WeatherStatus =
  'idle' | 'loading' | 'success' | 'unavailable' | 'error';

interface WeatherState {
  weather: CurrentWeather | null;
  status: WeatherStatus;
  error: string | null;
  /** `Date.now()` of the last successful load. */
  updatedAt: number | null;
  /** Locates the user and loads the weather there; no-op while loading. */
  refresh: () => Promise<void>;
  reset: () => void;
}

// Drops responses from a previous session landing after a reset.
let latestRequestId = 0;

export const useWeatherStore = create<WeatherState>()((set, get) => ({
  weather: null,
  status: 'idle',
  error: null,
  updatedAt: null,
  refresh: async () => {
    if (get().status === 'loading') return;
    const requestId = ++latestRequestId;
    // The previous weather stays on screen until the new one arrives.
    set({ status: 'loading', error: null });

    const position = await getApproximatePosition();
    if (requestId !== latestRequestId) return;
    if (!position) {
      // Access may have been revoked: don't keep showing the old place.
      set({ weather: null, status: 'unavailable', updatedAt: null });
      return;
    }

    try {
      const weather = await weatherApi.get(position);
      if (requestId !== latestRequestId) return;
      set({ weather, status: 'success', updatedAt: Date.now() });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  reset: () => {
    latestRequestId++;
    set({ weather: null, status: 'idle', error: null, updatedAt: null });
  },
}));

registerStoreReset(() => useWeatherStore.getState().reset());
