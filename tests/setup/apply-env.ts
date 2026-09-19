import { applyTestEnv } from './env';

// Loaded via `setupFiles`, so it runs in every test worker before the app.
applyTestEnv();
