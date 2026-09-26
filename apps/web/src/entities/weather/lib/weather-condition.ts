import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export interface WeatherCondition {
  label: string;
  Icon: LucideIcon;
}

type Condition = WeatherCondition | ((isDay: boolean) => WeatherCondition);

const clear = (isDay: boolean) => ({
  label: 'Clear sky',
  Icon: isDay ? Sun : Moon,
});
const partlyCloudy = (label: string) => (isDay: boolean) => ({
  label,
  Icon: isDay ? CloudSun : CloudMoon,
});
const overcast = { label: 'Overcast', Icon: Cloud };
const fog = { label: 'Fog', Icon: CloudFog };
const drizzle = { label: 'Drizzle', Icon: CloudDrizzle };
const freezingDrizzle = { label: 'Freezing drizzle', Icon: CloudDrizzle };
const rain = { label: 'Rain', Icon: CloudRain };
const freezingRain = { label: 'Freezing rain', Icon: CloudRain };
const showers = { label: 'Rain showers', Icon: CloudRain };
const snow = { label: 'Snow', Icon: CloudSnow };
const snowShowers = { label: 'Snow showers', Icon: CloudSnow };
const thunderstorm = { label: 'Thunderstorm', Icon: CloudLightning };
const hail = { label: 'Thunderstorm with hail', Icon: CloudHail };

/** WMO weather interpretation codes, as Open-Meteo reports them. */
const CONDITIONS: Record<number, Condition> = {
  0: clear,
  1: partlyCloudy('Mainly clear'),
  2: partlyCloudy('Partly cloudy'),
  3: overcast,
  45: fog,
  48: { label: 'Rime fog', Icon: CloudFog },
  51: drizzle,
  53: drizzle,
  55: drizzle,
  56: freezingDrizzle,
  57: freezingDrizzle,
  61: rain,
  63: rain,
  65: { label: 'Heavy rain', Icon: CloudRain },
  66: freezingRain,
  67: freezingRain,
  71: snow,
  73: snow,
  75: { label: 'Heavy snow', Icon: CloudSnow },
  77: { label: 'Snow grains', Icon: CloudSnow },
  80: showers,
  81: showers,
  82: { label: 'Violent rain showers', Icon: CloudRain },
  85: snowShowers,
  86: snowShowers,
  95: thunderstorm,
  96: hail,
  99: hail,
};

const UNKNOWN: WeatherCondition = { label: 'Unknown', Icon: Cloud };

/** The icon and wording for a WMO code; night variants for clear skies. */
export function describeWeather(
  code: number,
  isDay: boolean
): WeatherCondition {
  const condition = CONDITIONS[code];
  if (!condition) return UNKNOWN;
  return typeof condition === 'function' ? condition(isDay) : condition;
}
