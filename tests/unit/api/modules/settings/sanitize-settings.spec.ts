import { DEFAULT_LOCATION, DEFAULT_USER_SETTINGS } from '@expense-tracker/types';
import {
  roundCoordinate,
  sanitizeSettings,
} from '@api/modules/settings/lib/sanitize-settings';

describe('sanitizeSettings', () => {
  it.each([undefined, null, 'dark', 42, []])(
    'returns the defaults for %p',
    (stored) => {
      expect(sanitizeSettings(stored)).toEqual(DEFAULT_USER_SETTINGS);
    }
  );

  it('keeps every valid key', () => {
    const stored = {
      theme: 'dark',
      colorScheme: 'violet',
      currency: 'EUR',
      location: { mode: 'manual', name: 'Novi Sad, RS', lat: 45.25, lon: 19.84 },
    };

    expect(sanitizeSettings(stored)).toEqual(stored);
  });

  it('falls back key by key, keeping what is still valid', () => {
    expect(
      sanitizeSettings({
        theme: 'sepia',
        colorScheme: 'violet',
        currency: 'USD',
        location: { mode: 'manual', name: 'Nowhere' },
      })
    ).toEqual({ ...DEFAULT_USER_SETTINGS, colorScheme: 'violet' });
  });

  it('drops keys it does not know', () => {
    expect(sanitizeSettings({ theme: 'light', fontSize: 20 })).toEqual({
      ...DEFAULT_USER_SETTINGS,
      theme: 'light',
    });
  });

  it.each([
    [{ mode: 'manual', name: '  ', lat: 1, lon: 1 }],
    [{ mode: 'manual', name: 'X', lat: 91, lon: 1 }],
    [{ mode: 'manual', name: 'X', lat: 1, lon: -181 }],
    [{ mode: 'manual', name: 'X', lat: '45', lon: 19 }],
    [{ mode: 'elsewhere' }],
  ])('falls back to the default place for %p', (location) => {
    expect(sanitizeSettings({ location }).location).toEqual(DEFAULT_LOCATION);
  });

  it('strips extra fields from an automatic location', () => {
    expect(
      sanitizeSettings({ location: { mode: 'auto', name: 'Old', lat: 1 } })
        .location
    ).toEqual({ mode: 'auto' });
  });

  it('never hands out the shared default object', () => {
    const settings = sanitizeSettings(undefined);
    Object.assign(settings.location, { name: 'Changed' });

    expect(DEFAULT_LOCATION).toMatchObject({ name: 'Belgrade, RS' });
  });
});

describe('roundCoordinate', () => {
  it('keeps two decimals', () => {
    expect(roundCoordinate(45.25671)).toBe(45.26);
    expect(roundCoordinate(-19.844)).toBe(-19.84);
  });
});
