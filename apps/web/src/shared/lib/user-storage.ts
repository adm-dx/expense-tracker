type Listener = () => void;

let currentUserId: string | null = null;
const listeners = new Set<Listener>();

/**
 * Sets whose entries `userLocalStorage` reads and writes, and tells the stores
 * that persist through it to read theirs back. Called by the session store on
 * rehydration, sign-in, sign-out and auth failure; null means signed out.
 */
export function setStorageUser(userId: string | null): void {
  currentUserId = userId;
  for (const listener of listeners) {
    listener();
  }
}

/** Runs `listener` after every `setStorageUser`, e.g. to rehydrate a store. */
export function onStorageUserChange(listener: Listener): void {
  listeners.add(listener);
}

/**
 * `localStorage` with every key suffixed by the signed-in user's id, for
 * preferences that belong to a user rather than to the device (the period
 * filters), so they survive a sign-out and don't leak to the next user.
 * Signed out, it reads nothing and drops writes.
 */
export const userLocalStorage = {
  getItem: (name: string): string | null =>
    currentUserId === null
      ? null
      : localStorage.getItem(`${name}:${currentUserId}`),
  setItem: (name: string, value: string): void => {
    if (currentUserId === null) return;
    localStorage.setItem(`${name}:${currentUserId}`, value);
  },
  removeItem: (name: string): void => {
    if (currentUserId === null) return;
    localStorage.removeItem(`${name}:${currentUserId}`);
  },
};
