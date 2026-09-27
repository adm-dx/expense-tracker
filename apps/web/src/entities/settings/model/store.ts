import type {
  Currency,
  RemoveCurrencyResult,
  UpdateUserSettingsRequest,
  UserSettings,
} from '@expense-tracker/types';
import { DEFAULT_CURRENCIES } from '@expense-tracker/types';
import { create } from 'zustand';
import { settingsApi } from '@/shared/api/settings-api';
import { getErrorMessage } from '@/shared/lib/error';
import { registerStoreReset } from '@/shared/lib/store-reset';

export type SettingsStatus = 'idle' | 'loading' | 'success' | 'error';

interface SettingsState {
  /** null until loaded for the signed-in user. */
  settings: UserSettings | null;
  status: SettingsStatus;
  error: string | null;
  /** Loads once per session; pass `force` to refetch. */
  load: (options?: { force?: boolean }) => Promise<void>;
  /**
   * Shows the change at once and saves it. On failure the previous settings
   * come back and the error is rethrown for the caller to report.
   */
  update: (patch: UpdateUserSettingsRequest) => Promise<UserSettings>;
  /** Resets the saved settings to the defaults on the server. */
  resetToDefaults: () => Promise<UserSettings>;
  /** Enables a currency; not optimistic. */
  addCurrency: (code: Currency) => Promise<UserSettings>;
  /**
   * Disables a currency; the server converts its transactions to RSD first.
   * Not optimistic: the caller reloads the transactions afterwards.
   */
  removeCurrency: (code: Currency) => Promise<RemoveCurrencyResult>;
  /** Forgets the settings, on sign-in and sign-out. */
  reset: () => void;
}

// Bumped by `reset`: anything started in the previous session is dropped.
let sessionId = 0;
let latestLoadId = 0;
// A load that started before the latest write must not undo it.
let latestWriteId = 0;

export const useSettingsStore = create<SettingsState>()((set, get) => {
  /** Stores what a non-optimistic write answered, unless something newer ran. */
  async function write<T>(
    request: Promise<T>,
    settingsOf: (response: T) => UserSettings
  ): Promise<T> {
    const session = sessionId;
    const writeId = ++latestWriteId;
    const response = await request;
    if (session === sessionId && writeId === latestWriteId) {
      set({ settings: settingsOf(response), status: 'success', error: null });
    }
    return response;
  }

  return {
    settings: null,
    status: 'idle',
    error: null,
    load: async ({ force = false } = {}) => {
      const { status } = get();
      if (status === 'loading' || (status === 'success' && !force)) return;

      const loadId = ++latestLoadId;
      const writeIdAtStart = latestWriteId;
      set({ status: 'loading', error: null });
      try {
        const settings = await settingsApi.get();
        if (loadId !== latestLoadId) return;
        if (writeIdAtStart !== latestWriteId) {
          set({ status: 'success' });
          return;
        }
        set({ settings, status: 'success' });
      } catch (err) {
        if (loadId !== latestLoadId) return;
        set({ status: 'error', error: getErrorMessage(err) });
      }
    },
    update: async (patch) => {
      const session = sessionId;
      const writeId = ++latestWriteId;
      const previous = get().settings;
      if (previous) set({ settings: { ...previous, ...patch } });

      try {
        const saved = await settingsApi.update(patch);
        if (session === sessionId && writeId === latestWriteId) {
          set({ settings: saved, status: 'success', error: null });
        }
        return saved;
      } catch (err) {
        if (session === sessionId && writeId === latestWriteId) {
          set({ settings: previous });
        }
        throw err;
      }
    },
    resetToDefaults: () => write(settingsApi.reset(), (saved) => saved),
    addCurrency: (code) =>
      write(settingsApi.addCurrency(code), (saved) => saved),
    removeCurrency: (code) =>
      write(settingsApi.removeCurrency(code), (result) => result.settings),
    reset: () => {
      sessionId++;
      latestLoadId++;
      set({ settings: null, status: 'idle', error: null });
    },
  };
});

/** The user's currencies; the default ones until the settings arrive. */
export function useEnabledCurrencies(): readonly Currency[] {
  return useSettingsStore(
    (state) => state.settings?.currencies ?? DEFAULT_CURRENCIES
  );
}

registerStoreReset(() => useSettingsStore.getState().reset());
