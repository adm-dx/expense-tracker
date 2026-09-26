import {
  COLOR_SCHEMES,
  DEFAULT_USER_SETTINGS,
  THEMES,
  type ColorScheme,
  type Theme,
} from '@expense-tracker/types';

/** What the page is painted with: light/dark/system plus a color scheme. */
export interface ThemeSelection {
  theme: Theme;
  colorScheme: ColorScheme;
}

export type ThemeMode = 'light' | 'dark';

/** Device cache of the user's theme, read before the first paint. */
export const THEME_STORAGE_KEY = 'theme';

export const DEFAULT_THEME: ThemeSelection = {
  theme: DEFAULT_USER_SETTINGS.theme,
  colorScheme: DEFAULT_USER_SETTINGS.colorScheme,
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  );
}

/** `system` becomes whatever the operating system is set to right now. */
export function resolveMode(theme: Theme): ThemeMode {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}

let applied: ThemeSelection | null = null;
let stopWatchingSystem: (() => void) | null = null;

function paint(selection: ThemeSelection): void {
  const root = document.documentElement;
  const mode = resolveMode(selection.theme);
  root.dataset.scheme = selection.colorScheme;
  root.dataset.mode = mode;
  // Tailwind's `dark:` variants key off the class.
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
}

/**
 * Paints <html> with the selection (see the color schemes in globals.css).
 * While the theme is `system`, it follows the OS switching light and dark.
 */
export function applyTheme(selection: ThemeSelection): void {
  if (typeof document === 'undefined') return;
  applied = selection;
  paint(selection);

  if (selection.theme !== 'system') {
    stopWatchingSystem?.();
    stopWatchingSystem = null;
  } else if (!stopWatchingSystem && typeof window.matchMedia === 'function') {
    const media = window.matchMedia(DARK_QUERY);
    const handleChange = () => {
      if (applied) paint(applied);
    };
    media.addEventListener('change', handleChange);
    stopWatchingSystem = () =>
      media.removeEventListener('change', handleChange);
  }
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return (values as readonly unknown[]).includes(value);
}

/** Anything unreadable falls back to the default, key by key. */
export function parseThemeSelection(value: unknown): ThemeSelection {
  const source =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return {
    theme: isOneOf(THEMES, source.theme) ? source.theme : DEFAULT_THEME.theme,
    colorScheme: isOneOf(COLOR_SCHEMES, source.colorScheme)
      ? source.colorScheme
      : DEFAULT_THEME.colorScheme,
  };
}

export function readCachedTheme(): ThemeSelection {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return parseThemeSelection(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_THEME;
  }
}

export function cacheTheme(selection: ThemeSelection): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Storage may be full or blocked; the theme still comes from the server.
  }
}

/**
 * Runs in <head> before the first paint (see the "Preventing Flash" guide in
 * the Next.js docs): paints the cached theme the way `applyTheme` does, so a
 * dark page never flashes white.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,t=${JSON.stringify(
  DEFAULT_THEME
)},s=JSON.parse(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})||"null");if(s&&${JSON.stringify(THEMES)}.indexOf(s.theme)>-1)t.theme=s.theme;if(s&&${JSON.stringify(
  COLOR_SCHEMES
)}.indexOf(s.colorScheme)>-1)t.colorScheme=s.colorScheme;var m=t.theme==="system"?(window.matchMedia&&matchMedia(${JSON.stringify(
  DARK_QUERY
)}).matches?"dark":"light"):t.theme;d.dataset.scheme=t.colorScheme;d.dataset.mode=m;d.classList.toggle("dark",m==="dark");d.style.colorScheme=m}catch(e){}})()`;
