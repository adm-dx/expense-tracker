import {
  Cloud,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';
import { describeWeather } from '@web/entities/weather';

describe('describeWeather', () => {
  it.each([
    [0, true, 'Clear sky', Sun],
    [0, false, 'Clear sky', Moon],
    [2, true, 'Partly cloudy', CloudSun],
    [1, false, 'Mainly clear', CloudMoon],
    [3, false, 'Overcast', Cloud],
    [45, true, 'Fog', CloudFog],
    [63, true, 'Rain', CloudRain],
    [81, true, 'Rain showers', CloudRain],
    [73, true, 'Snow', CloudSnow],
    [95, true, 'Thunderstorm', CloudLightning],
    [99, false, 'Thunderstorm with hail', CloudHail],
  ])('code %p (day: %p) → %p', (code, isDay, label, Icon) => {
    expect(describeWeather(code, isDay)).toEqual({ label, Icon });
  });

  it('falls back for a code it does not know', () => {
    expect(describeWeather(42, true)).toEqual({
      label: 'Unknown',
      Icon: Cloud,
    });
  });
});
