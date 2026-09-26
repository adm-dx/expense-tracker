import type { Place } from '@expense-tracker/types';
import { useRef, useState } from 'react';
import { weatherApi } from '@/shared/api/weather-api';
import { getErrorMessage } from '@/shared/lib/error';

export type PlaceSearchStatus = 'idle' | 'loading' | 'success' | 'error';

export const MIN_QUERY_LENGTH = 2;

/**
 * Looks towns up by name, one explicit search at a time: Nominatim's policy
 * forbids search-as-you-type.
 */
export function usePlaceSearch() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<PlaceSearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // Only the latest search may fill the list.
  const latestSearch = useRef(0);

  async function search(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    const searchId = ++latestSearch.current;
    setStatus('loading');
    setError(null);
    try {
      const found = await weatherApi.searchPlaces(trimmed);
      if (searchId !== latestSearch.current) return;
      setPlaces(found);
      setStatus('success');
    } catch (err) {
      if (searchId !== latestSearch.current) return;
      setPlaces([]);
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  function clear() {
    latestSearch.current++;
    setPlaces([]);
    setStatus('idle');
    setError(null);
  }

  return { places, status, error, search, clear };
}
