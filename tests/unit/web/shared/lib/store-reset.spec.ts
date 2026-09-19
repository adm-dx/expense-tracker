describe('store-reset', () => {
  // The registry is module-level state: load a fresh copy for every test.
  function load() {
    let mod!: typeof import('@web/shared/lib/store-reset');
    jest.isolateModules(() => {
      mod = require('@web/shared/lib/store-reset');
    });
    return mod;
  }

  it('runs every registered reset', () => {
    const { registerStoreReset, resetRegisteredStores } = load();
    const a = jest.fn();
    const b = jest.fn();
    registerStoreReset(a);
    registerStoreReset(b);

    resetRegisteredStores();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('runs a reset again on every call', () => {
    const { registerStoreReset, resetRegisteredStores } = load();
    const reset = jest.fn();
    registerStoreReset(reset);

    resetRegisteredStores();
    resetRegisteredStores();

    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('registering the same function twice runs it once', () => {
    const { registerStoreReset, resetRegisteredStores } = load();
    const reset = jest.fn();
    registerStoreReset(reset);
    registerStoreReset(reset);

    resetRegisteredStores();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('is a no-op with nothing registered', () => {
    const { resetRegisteredStores } = load();

    expect(() => resetRegisteredStores()).not.toThrow();
  });
});
