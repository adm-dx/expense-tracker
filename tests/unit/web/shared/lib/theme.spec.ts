import { COLOR_SCHEMES, THEMES } from '@expense-tracker/types';
import { COLOR_SCHEME_LABELS } from '@web/shared/lib/color-schemes';
import {
  applyTheme,
  cacheTheme,
  DEFAULT_THEME,
  parseThemeSelection,
  readCachedTheme,
  resolveMode,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from '@web/shared/lib/theme';

type Listener = () => void;

/** jsdom has no matchMedia; this one lets a test flip the OS setting. */
function mockSystemTheme(dark: boolean) {
  const listeners = new Set<Listener>();
  const media = {
    matches: dark,
    addEventListener: jest.fn((_: string, listener: Listener) => {
      listeners.add(listener);
    }),
    removeEventListener: jest.fn((_: string, listener: Listener) => {
      listeners.delete(listener);
    }),
  };
  window.matchMedia = jest.fn(() => media) as unknown as typeof matchMedia;
  return {
    media,
    listeners,
    set(nextDark: boolean) {
      media.matches = nextDark;
      listeners.forEach((listener) => listener());
    },
  };
}

const root = () => document.documentElement;

function resetRoot() {
  root().removeAttribute('data-scheme');
  root().removeAttribute('data-mode');
  root().removeAttribute('style');
  root().classList.remove('dark');
}

beforeEach(() => {
  localStorage.clear();
  resetRoot();
  mockSystemTheme(false);
  // Leave no `system` listener behind from the previous test.
  applyTheme({ theme: 'light', colorScheme: 'slate' });
  resetRoot();
});

describe('resolveMode', () => {
  it('keeps an explicit mode', () => {
    expect(resolveMode('dark')).toBe('dark');
    expect(resolveMode('light')).toBe('light');
  });

  it('follows the OS for system', () => {
    mockSystemTheme(true);
    expect(resolveMode('system')).toBe('dark');
    mockSystemTheme(false);
    expect(resolveMode('system')).toBe('light');
  });
});

describe('applyTheme', () => {
  it('paints <html> with the scheme and the mode', () => {
    applyTheme({ theme: 'dark', colorScheme: 'violet' });

    expect(root().dataset.scheme).toBe('violet');
    expect(root().dataset.mode).toBe('dark');
    expect(root()).toHaveClass('dark');
    expect(root().style.colorScheme).toBe('dark');
  });

  it('takes the dark class away again for light', () => {
    applyTheme({ theme: 'dark', colorScheme: 'blue' });
    applyTheme({ theme: 'light', colorScheme: 'blue' });

    expect(root()).not.toHaveClass('dark');
    expect(root().dataset.mode).toBe('light');
  });

  it('follows the OS while the theme is system', () => {
    const system = mockSystemTheme(false);
    applyTheme({ theme: 'system', colorScheme: 'green' });
    expect(root().dataset.mode).toBe('light');

    system.set(true);

    expect(root().dataset.mode).toBe('dark');
    expect(root()).toHaveClass('dark');
    expect(root().dataset.scheme).toBe('green');
  });

  it('stops following the OS once an explicit mode is chosen', () => {
    const system = mockSystemTheme(false);
    applyTheme({ theme: 'system', colorScheme: 'slate' });
    applyTheme({ theme: 'light', colorScheme: 'slate' });

    system.set(true);

    expect(root().dataset.mode).toBe('light');
    expect(system.listeners.size).toBe(0);
  });

  it('listens to the OS only once however often it is applied', () => {
    const system = mockSystemTheme(false);
    applyTheme({ theme: 'system', colorScheme: 'slate' });
    applyTheme({ theme: 'system', colorScheme: 'rose' });

    expect(system.listeners.size).toBe(1);
    system.set(true);
    expect(root().dataset.scheme).toBe('rose');
  });
});

describe('the theme cache', () => {
  it('round-trips a selection', () => {
    cacheTheme({ theme: 'dark', colorScheme: 'orange' });

    expect(readCachedTheme()).toEqual({ theme: 'dark', colorScheme: 'orange' });
  });

  it('falls back to the default for nothing, junk or unknown values', () => {
    expect(readCachedTheme()).toEqual(DEFAULT_THEME);

    localStorage.setItem(THEME_STORAGE_KEY, '{not json');
    expect(readCachedTheme()).toEqual(DEFAULT_THEME);

    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ theme: 'sepia', colorScheme: 'blue' })
    );
    expect(readCachedTheme()).toEqual({ ...DEFAULT_THEME, colorScheme: 'blue' });
  });

  it('parses every known theme and scheme', () => {
    for (const theme of THEMES) {
      for (const colorScheme of COLOR_SCHEMES) {
        expect(parseThemeSelection({ theme, colorScheme })).toEqual({
          theme,
          colorScheme,
        });
      }
    }
  });
});

describe('THEME_INIT_SCRIPT', () => {
  // The script runs in <head> before any bundle, so it can't import
  // `applyTheme`; it must still paint exactly the same way.
  const run = () => new Function(THEME_INIT_SCRIPT)();

  it('paints the cached theme', () => {
    cacheTheme({ theme: 'dark', colorScheme: 'yellow' });

    run();

    expect(root().dataset.scheme).toBe('yellow');
    expect(root().dataset.mode).toBe('dark');
    expect(root()).toHaveClass('dark');
    expect(root().style.colorScheme).toBe('dark');
  });

  it('resolves system against the OS', () => {
    mockSystemTheme(true);
    cacheTheme({ theme: 'system', colorScheme: 'zinc' });

    run();

    expect(root().dataset.mode).toBe('dark');
  });

  it('paints the default for a missing or bad cache', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ theme: 'sepia', colorScheme: 'teal' })
    );

    run();

    expect(root().dataset.scheme).toBe(DEFAULT_THEME.colorScheme);
    expect(root().dataset.mode).toBe('light');
  });

  it('never throws, even when storage is broken', () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    try {
      expect(run).not.toThrow();
    } finally {
      getItem.mockRestore();
    }
  });
});

describe('COLOR_SCHEME_LABELS', () => {
  it('names every color scheme', () => {
    expect(Object.keys(COLOR_SCHEME_LABELS).sort()).toEqual(
      [...COLOR_SCHEMES].sort()
    );
  });
});
