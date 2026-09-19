type ResetFn = () => void;

const resets = new Set<ResetFn>();

/**
 * Registers a store's `reset` so it runs whenever the session changes.
 * Keeps the session layer from having to know about domain stores (and the
 * domain stores from importing the session store sideways).
 */
export function registerStoreReset(reset: ResetFn): void {
  resets.add(reset);
}

/** Called by the session store on sign-in, sign-out and auth failure. */
export function resetRegisteredStores(): void {
  for (const reset of resets) {
    reset();
  }
}
