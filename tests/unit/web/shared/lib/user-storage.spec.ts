describe('user-storage', () => {
  // The current user and the listeners are module-level state: load a fresh
  // copy for every test.
  function load() {
    let mod!: typeof import('@web/shared/lib/user-storage');
    jest.isolateModules(() => {
      mod = require('@web/shared/lib/user-storage');
    });
    return mod;
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps each user's entries under their own key", () => {
    const { setStorageUser, userLocalStorage } = load();

    setStorageUser('user-a');
    userLocalStorage.setItem('filter', 'a');
    setStorageUser('user-b');
    userLocalStorage.setItem('filter', 'b');

    expect(localStorage.getItem('filter:user-a')).toBe('a');
    expect(userLocalStorage.getItem('filter')).toBe('b');
    userLocalStorage.removeItem('filter');
    expect(localStorage.getItem('filter:user-b')).toBeNull();
    expect(localStorage.getItem('filter:user-a')).toBe('a');
  });

  it('reads nothing and writes nothing while signed out', () => {
    const { setStorageUser, userLocalStorage } = load();
    setStorageUser('user-a');
    userLocalStorage.setItem('filter', 'a');

    setStorageUser(null);
    userLocalStorage.setItem('filter', 'default');

    expect(userLocalStorage.getItem('filter')).toBeNull();
    expect(localStorage.getItem('filter:user-a')).toBe('a');
    expect(localStorage.length).toBe(1);
  });

  it('notifies the listeners on every change of user', () => {
    const { setStorageUser, onStorageUserChange } = load();
    const listener = jest.fn();
    onStorageUserChange(listener);

    setStorageUser('user-a');
    setStorageUser(null);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
