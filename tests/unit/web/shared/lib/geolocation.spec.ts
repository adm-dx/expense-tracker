import {
  getApproximatePosition,
  onGeolocationPermissionChange,
  POSITION_MAX_AGE_MS,
  POSITION_TIMEOUT_MS,
  roundCoordinate,
} from '@web/shared/lib/geolocation';

type GetCurrentPosition = Geolocation['getCurrentPosition'];

function stubNavigator(key: 'geolocation' | 'permissions', value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true });
}

afterEach(() => {
  // jsdom has neither; put things back the way they were.
  Reflect.deleteProperty(navigator, 'geolocation');
  Reflect.deleteProperty(navigator, 'permissions');
});

describe('getApproximatePosition', () => {
  it('resolves to the position rounded to two decimals', async () => {
    const getCurrentPosition = jest.fn<void, Parameters<GetCurrentPosition>>(
      (success) =>
        success({
          coords: { latitude: 44.786568, longitude: 20.448921 },
        } as GeolocationPosition)
    );
    stubNavigator('geolocation', { getCurrentPosition });

    await expect(getApproximatePosition()).resolves.toEqual({
      lat: 44.79,
      lon: 20.45,
    });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        maximumAge: POSITION_MAX_AGE_MS,
        timeout: POSITION_TIMEOUT_MS,
      }
    );
  });

  it.each([
    ['permission denied', 1],
    ['position unavailable', 2],
    ['timeout', 3],
  ])('resolves to null on %s', async (_, code) => {
    stubNavigator('geolocation', {
      getCurrentPosition: (
        _success: PositionCallback,
        error: PositionErrorCallback
      ) => error({ code, message: '' } as GeolocationPositionError),
    });

    await expect(getApproximatePosition()).resolves.toBeNull();
  });

  it('resolves to null without the Geolocation API', async () => {
    await expect(getApproximatePosition()).resolves.toBeNull();
  });
});

describe('roundCoordinate', () => {
  it.each([
    [44.786568, 44.79],
    [-19.046, -19.05],
    [0.004, 0],
  ])('%p → %p', (value, expected) => {
    expect(roundCoordinate(value)).toBe(expected);
  });
});

describe('onGeolocationPermissionChange', () => {
  function makeStatus(state: PermissionState) {
    const status = new EventTarget() as PermissionStatus & {
      state: PermissionState;
    };
    status.state = state;
    return status;
  }

  it('reports changes to the geolocation permission', async () => {
    const status = makeStatus('prompt');
    const query = jest.fn().mockResolvedValue(status);
    stubNavigator('permissions', { query });
    const listener = jest.fn();

    onGeolocationPermissionChange(listener);
    await Promise.resolve();
    status.state = 'granted';
    status.dispatchEvent(new Event('change'));

    expect(query).toHaveBeenCalledWith({ name: 'geolocation' });
    expect(listener).toHaveBeenCalledWith('granted');
  });

  it('stops reporting after unsubscribing', async () => {
    const status = makeStatus('prompt');
    stubNavigator('permissions', {
      query: jest.fn().mockResolvedValue(status),
    });
    const listener = jest.fn();

    const unsubscribe = onGeolocationPermissionChange(listener);
    await Promise.resolve();
    unsubscribe();
    status.dispatchEvent(new Event('change'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not subscribe when unsubscribed before the query settles', async () => {
    const status = makeStatus('prompt');
    stubNavigator('permissions', {
      query: jest.fn().mockResolvedValue(status),
    });
    const listener = jest.fn();

    onGeolocationPermissionChange(listener)();
    await Promise.resolve();
    status.dispatchEvent(new Event('change'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('is a no-op without the Permissions API', () => {
    expect(() => onGeolocationPermissionChange(jest.fn())()).not.toThrow();
  });

  it('ignores browsers that cannot query geolocation', async () => {
    stubNavigator('permissions', {
      query: jest.fn().mockRejectedValue(new TypeError('unsupported')),
    });

    const unsubscribe = onGeolocationPermissionChange(jest.fn());
    await Promise.resolve();

    expect(unsubscribe).not.toThrow();
  });
});
