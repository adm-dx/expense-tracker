import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_USER_SETTINGS,
  type CurrentWeather,
  type LocationSetting,
} from '@expense-tracker/types';
import { useSettingsStore } from '@web/entities/settings';
import { useWeatherStore } from '@web/entities/weather';
import { WeatherWidget } from '@web/features/weather/current';
import { weatherApi } from '@web/shared/api/weather-api';
import {
  getApproximatePosition,
  onGeolocationPermissionChange,
} from '@web/shared/lib/geolocation';

jest.mock('@web/shared/api/weather-api', () => ({
  weatherApi: { get: jest.fn() },
}));
jest.mock('@web/shared/lib/geolocation', () => ({
  getApproximatePosition: jest.fn(),
  onGeolocationPermissionChange: jest.fn(),
}));

const getWeather = weatherApi.get as jest.MockedFunction<typeof weatherApi.get>;
const locate = getApproximatePosition as jest.MockedFunction<
  typeof getApproximatePosition
>;
const watchPermission = onGeolocationPermissionChange as jest.MockedFunction<
  typeof onGeolocationPermissionChange
>;

const HOUR = 60 * 60 * 1000;
const WEATHER: CurrentWeather = {
  temperature: 18.4,
  weatherCode: 2,
  isDay: true,
  location: 'Belgrade, RS',
  observedAt: '2026-09-26T12:00:00.000Z',
  forecast: [
    {
      date: '2026-09-26',
      weatherCode: 2,
      temperatureMax: 21.3,
      temperatureMin: 11.8,
      precipitationProbability: 10,
    },
    {
      date: '2026-09-27',
      weatherCode: 61,
      temperatureMax: 17,
      temperatureMin: -0.4,
      precipitationProbability: 80,
    },
    {
      date: '2026-09-28',
      weatherCode: 0,
      temperatureMax: 19,
      temperatureMin: 9,
      precipitationProbability: null,
    },
  ],
};

let unwatchPermission: jest.Mock;

function setLocation(location: LocationSetting) {
  useSettingsStore.setState({
    settings: { ...DEFAULT_USER_SETTINGS, location },
    status: 'success',
  });
}

const NOVI_SAD: LocationSetting = {
  mode: 'manual',
  name: 'Novi Sad, RS',
  lat: 45.25,
  lon: 19.84,
};

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets the pending geolocation and API promises settle. */
async function flush() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-09-26T12:00:00.000Z') });
  locate.mockReset();
  getWeather.mockReset();
  unwatchPermission = jest.fn();
  watchPermission.mockReset();
  watchPermission.mockReturnValue(unwatchPermission);
  locate.mockResolvedValue({ lat: 44.79, lon: 20.45 });
  getWeather.mockResolvedValue(WEATHER);
  useWeatherStore.getState().reset();
  useSettingsStore.getState().reset();
  setLocation({ mode: 'auto' });
});

afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState');
  jest.useRealTimers();
});

describe('WeatherWidget', () => {
  it('shows the condition, temperature and place', async () => {
    render(<WeatherWidget />);
    await flush();

    const trigger = screen.getByRole('button', {
      name: 'Weather: Partly cloudy, 18°C in Belgrade, RS',
    });
    expect(trigger).toHaveTextContent('18°C');
    expect(trigger).toHaveTextContent('Belgrade, RS');
    expect(trigger.querySelector('svg')).toBeInTheDocument();
  });

  it('leaves the place out when it has no name', async () => {
    getWeather.mockResolvedValue({ ...WEATHER, location: null });

    render(<WeatherWidget />);
    await flush();

    expect(
      screen.getByRole('button', { name: 'Weather: Partly cloudy, 18°C' })
    ).toHaveTextContent(/^18°C$/);
  });

  it('shows a placeholder while locating', () => {
    locate.mockReturnValue(new Promise(() => {}));

    render(<WeatherWidget />);

    expect(screen.getByTestId('weather-skeleton')).toBeInTheDocument();
  });

  it('renders nothing when location access is denied', async () => {
    locate.mockResolvedValue(null);

    const { container } = render(<WeatherWidget />);
    await flush();

    expect(container).toBeEmptyDOMElement();
    expect(getWeather).not.toHaveBeenCalled();
  });

  it('renders nothing when the weather cannot be loaded', async () => {
    getWeather.mockRejectedValue(new Error('Weather is unavailable'));

    const { container } = render(<WeatherWidget />);
    await flush();

    expect(container).toBeEmptyDOMElement();
  });

  it('refreshes every hour', async () => {
    render(<WeatherWidget />);
    await flush();
    expect(getWeather).toHaveBeenCalledTimes(1);
    getWeather.mockResolvedValue({ ...WEATHER, temperature: 21 });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(HOUR);
    });

    expect(getWeather).toHaveBeenCalledTimes(2);
    // Automatic loads leave the server's cache alone.
    expect(getWeather).toHaveBeenLastCalledWith({ lat: 44.79, lon: 20.45 });
    expect(screen.getByRole('button')).toHaveTextContent('21°C');
  });

  it('refreshes a tab that comes back with hour-old weather', async () => {
    render(<WeatherWidget />);
    await flush();

    // A background tab's timers may not have fired at all.
    jest.setSystemTime(Date.now() + HOUR);
    act(() => setVisibility('visible'));
    await flush();

    expect(getWeather).toHaveBeenCalledTimes(2);
  });

  it('does not refresh a tab that comes back with fresh weather', async () => {
    render(<WeatherWidget />);
    await flush();

    jest.setSystemTime(Date.now() + HOUR - 1);
    act(() => setVisibility('visible'));
    await flush();

    expect(getWeather).toHaveBeenCalledTimes(1);
  });

  it('reloads when the location permission changes', async () => {
    locate.mockResolvedValue(null);
    render(<WeatherWidget />);
    await flush();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    locate.mockResolvedValue({ lat: 44.79, lon: 20.45 });
    const listener = watchPermission.mock.calls[0]![0];
    act(() => listener('granted'));
    await flush();

    expect(getWeather).toHaveBeenLastCalledWith({ lat: 44.79, lon: 20.45 });
    expect(screen.getByRole('button')).toHaveTextContent('18°C');
  });

  it('stops refreshing once unmounted', async () => {
    const { unmount } = render(<WeatherWidget />);
    await flush();

    unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(HOUR);
    });
    jest.setSystemTime(Date.now() + HOUR);
    setVisibility('visible');
    await flush();

    expect(getWeather).toHaveBeenCalledTimes(1);
    expect(unwatchPermission).toHaveBeenCalled();
  });

  it('waits for the settings before asking for a position', async () => {
    useSettingsStore.getState().reset();
    render(<WeatherWidget />);
    await flush();
    expect(locate).not.toHaveBeenCalled();

    act(() => setLocation({ mode: 'auto' }));
    await flush();

    expect(locate).toHaveBeenCalledTimes(1);
    expect(getWeather).toHaveBeenCalledWith({ lat: 44.79, lon: 20.45 });
  });

  it('uses the browser position when the settings cannot be loaded', async () => {
    useSettingsStore.getState().reset();
    useSettingsStore.setState({ status: 'error', error: 'down' });

    render(<WeatherWidget />);
    await flush();

    expect(locate).toHaveBeenCalledTimes(1);
  });

  it('shows the weather for the town chosen in the settings', async () => {
    setLocation(NOVI_SAD);

    render(<WeatherWidget />);
    await flush();

    expect(locate).not.toHaveBeenCalled();
    expect(getWeather).toHaveBeenCalledWith({ lat: 45.25, lon: 19.84 });
    // The permission only matters for the browser's position.
    expect(watchPermission).not.toHaveBeenCalled();
  });

  it('switches place when the setting changes', async () => {
    render(<WeatherWidget />);
    await flush();
    expect(getWeather).toHaveBeenLastCalledWith({ lat: 44.79, lon: 20.45 });

    act(() => setLocation(NOVI_SAD));
    await flush();
    expect(getWeather).toHaveBeenLastCalledWith({ lat: 45.25, lon: 19.84 });
    expect(unwatchPermission).toHaveBeenCalled();

    act(() => setLocation({ mode: 'auto' }));
    await flush();
    expect(locate).toHaveBeenCalledTimes(2);
  });

  function setupUser() {
    return userEvent.setup({
      advanceTimers: (ms) => jest.advanceTimersByTime(ms),
    });
  }

  it('opens the details with the update time and attribution', async () => {
    const user = setupUser();
    render(<WeatherWidget />);
    await flush();

    await user.click(screen.getByRole('button'));

    expect(await screen.findByText('Partly cloudy')).toBeInTheDocument();
    expect(
      screen.getByText(/^Updated \d{1,2}:00 (AM|PM)$/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Weather by Open-Meteo' })
    ).toHaveAttribute('href', 'https://open-meteo.com');
    expect(
      screen.getByRole('link', { name: '© OpenStreetMap contributors' })
    ).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  });

  it('shows the forecast day by day', async () => {
    const user = setupUser();
    render(<WeatherWidget />);
    await flush();

    await user.click(screen.getByRole('button'));

    const list = await screen.findByRole('list', { name: '3-day forecast' });
    const days = within(list).getAllByRole('listitem');
    expect(days.map((day) => day.getAttribute('aria-label'))).toEqual([
      'Today: Partly cloudy, 12°C to 21°C, 10% chance of precipitation',
      'Sun: Rain, 0°C to 17°C, 80% chance of precipitation',
      'Mon: Clear sky, 9°C to 19°C',
    ]);
    expect(days[1]).toHaveTextContent('80%');
  });

  it('leaves the forecast out when there is none', async () => {
    getWeather.mockResolvedValue({ ...WEATHER, forecast: [] });
    const user = setupUser();
    render(<WeatherWidget />);
    await flush();

    await user.click(screen.getByRole('button'));

    expect(await screen.findByText('Partly cloudy')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('asks the server again from the refresh button', async () => {
    const user = setupUser();
    render(<WeatherWidget />);
    await flush();
    await user.click(screen.getByRole('button'));
    getWeather.mockResolvedValue({ ...WEATHER, temperature: 21 });

    await user.click(
      await screen.findByRole('button', { name: 'Refresh weather' })
    );
    await flush();

    expect(getWeather).toHaveBeenCalledTimes(2);
    expect(getWeather).toHaveBeenLastCalledWith(
      { lat: 44.79, lon: 20.45 },
      { refresh: true }
    );
    expect(
      screen.getByRole('button', { name: /^Weather: .*21°C/ })
    ).toBeInTheDocument();
  });

  it('refreshes the town chosen in the settings', async () => {
    setLocation(NOVI_SAD);
    const user = setupUser();
    render(<WeatherWidget />);
    await flush();
    await user.click(screen.getByRole('button'));

    await user.click(
      await screen.findByRole('button', { name: 'Refresh weather' })
    );
    await flush();

    expect(getWeather).toHaveBeenCalledTimes(2);
    expect(getWeather).toHaveBeenLastCalledWith(
      { lat: 45.25, lon: 19.84 },
      { refresh: true }
    );
    expect(locate).not.toHaveBeenCalled();
  });

  it('disables the refresh button while loading', async () => {
    const user = setupUser();
    render(<WeatherWidget />);
    await flush();
    await user.click(screen.getByRole('button'));
    getWeather.mockReturnValue(new Promise(() => {}));

    const refresh = await screen.findByRole('button', {
      name: 'Refresh weather',
    });
    await user.click(refresh);
    await flush();

    expect(refresh).toBeDisabled();
    // The last weather stays on screen meanwhile.
    expect(screen.getByText('Partly cloudy')).toBeInTheDocument();
  });

  it('keeps the last weather and says so when a refresh fails', async () => {
    const user = setupUser();
    render(<WeatherWidget />);
    await flush();
    await user.click(screen.getByRole('button'));
    getWeather.mockRejectedValue(new Error('Weather is unavailable'));

    await user.click(
      await screen.findByRole('button', { name: 'Refresh weather' })
    );
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't refresh the weather"
    );
    expect(screen.getByText('Partly cloudy')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Refresh weather' })
    ).toBeEnabled();
  });
});
