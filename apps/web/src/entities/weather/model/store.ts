import type { CurrentWeather } from '@expense-tracker/types';
import { create } from 'zustand';
import { weatherApi } from '@/shared/api/weather-api';
import { getErrorMessage } from '@/shared/lib/error';
import {
  getApproximatePosition,
  type Coordinates,
} from '@/shared/lib/geolocation';
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
  /**
   * Loads the weather at `position`, or where the browser says the user is
   * when it's omitted. A no-op while the same place is loading; a request for
   * another place supersedes the one in flight.
   */
  refresh: (position?: Coordinates) => Promise<void>;
  reset: () => void;
}

// Drops responses from a previous session or a superseded place.
let latestRequestId = 0;
let loadingTarget: string | null = null;

export const useWeatherStore = create<WeatherState>()((set, get) => ({
  weather: null,
  status: 'idle',
  error: null,
  updatedAt: null,
  refresh: async (fixedPosition) => {
    const target = fixedPosition
      ? `${fixedPosition.lat},${fixedPosition.lon}`
      : 'browser';
    if (get().status === 'loading' && loadingTarget === target) return;
    const requestId = ++latestRequestId;
    loadingTarget = target;
    // The previous weather stays on screen until the new one arrives.
    set({ status: 'loading', error: null });

    const position = fixedPosition ?? (await getApproximatePosition());
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
    loadingTarget = null;
    set({ weather: null, status: 'idle', error: null, updatedAt: null });
  },
}));

registerStoreReset(() => useWeatherStore.getState().reset());
