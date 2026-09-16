'use client';

import { useEffect } from 'react';
import { useSessionStore } from '../model/store';

export function SessionHydration() {
  useEffect(() => {
    void useSessionStore.persist.rehydrate();
  }, []);

  return null;
}
