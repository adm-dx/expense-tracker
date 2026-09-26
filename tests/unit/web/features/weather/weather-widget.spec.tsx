import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CurrentWeather } from '@expense-tracker/types';
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
};

let unwatchPermission: jest.Mock;

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

  it('opens the details with the update time and attribution', async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => jest.advanceTimersByTime(ms),
    });
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
});
