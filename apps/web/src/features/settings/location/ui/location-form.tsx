'use client';

import type {
  LocationMode,
  LocationSetting,
  Place,
} from '@expense-tracker/types';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/entities/settings';
import { getErrorMessage } from '@/shared/lib/error';
import {
  Button,
  Input,
  SegmentedControl,
  type SegmentedControlOption,
} from '@/shared/ui';
import { MIN_QUERY_LENGTH, usePlaceSearch } from '../model/use-place-search';

const MODE_OPTIONS: readonly SegmentedControlOption<LocationMode>[] = [
  { value: 'auto', label: 'My position', icon: LocateFixed },
  { value: 'manual', label: 'A chosen town', icon: MapPin },
];

interface LocationFormProps {
  value: LocationSetting;
}

/**
 * Where the header shows the weather for: the browser's position, or a town
 * found by name.
 */
export function LocationForm({ value }: LocationFormProps) {
  const update = useSettingsStore((state) => state.update);
  const { places, status, error, search, clear } = usePlaceSearch();
  // Picking a town before one is saved, or replacing the saved one.
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const mode: LocationMode = picking ? 'manual' : value.mode;

  function save(location: LocationSetting) {
    update({ location }).catch((err: unknown) => {
      toast.error(getErrorMessage(err));
    });
  }

  function changeMode(next: LocationMode) {
    if (next === 'auto') {
      setPicking(false);
      clear();
      if (value.mode !== 'auto') save({ mode: 'auto' });
    } else if (value.mode !== 'manual') {
      setPicking(true);
    }
  }

  function choose(place: Place) {
    save({ mode: 'manual', ...place });
    setPicking(false);
    setQuery('');
    clear();
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        name="location-mode"
        aria-label="Show the weather for"
        value={mode}
        options={MODE_OPTIONS}
        onValueChange={changeMode}
      />

      {mode === 'auto' && (
        <p className="text-sm text-muted-foreground">
          The browser tells the app roughly where you are (to about a
          kilometre). Without access to your location, the weather is hidden.
        </p>
      )}

      {value.mode === 'manual' && !picking && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            Weather for <span className="font-medium">{value.name}</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            Change town
          </Button>
        </div>
      )}

      {picking && (
        <div className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void search(query);
            }}
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Town, e.g. Novi Sad"
              aria-label="Town"
              maxLength={100}
              className="max-w-xs"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={
                status === 'loading' || query.trim().length < MIN_QUERY_LENGTH
              }
            >
              <Search />
              {status === 'loading' ? 'Searching…' : 'Search'}
            </Button>
            {value.mode === 'manual' && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPicking(false);
                  clear();
                }}
              >
                Cancel
              </Button>
            )}
          </form>

          {status === 'error' && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {status === 'success' && places.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No towns found. Try another spelling.
            </p>
          )}
          {places.length > 0 && (
            <ul className="divide-y rounded-md border" aria-label="Towns found">
              {places.map((place) => (
                <li key={`${place.lat},${place.lon}`}>
                  <button
                    type="button"
                    onClick={() => choose(place)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <MapPin
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {place.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Search by{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              © OpenStreetMap contributors
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
