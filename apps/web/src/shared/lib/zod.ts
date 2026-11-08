import { z } from 'zod';

// The CSP (src/proxy.ts) has no 'unsafe-eval'. Zod would otherwise probe
// `new Function` on its first parse to compile schemas; it falls back when
// that throws, but the browser reports each probe as a CSP violation.
z.config({ jitless: true });

/** Zod with code generation off; import it from here, not from `zod`. */
export { z };
