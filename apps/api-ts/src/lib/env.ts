/**
 * Production deployment guards and shared secret accessors.
 * Tests and local dev use NODE_ENV !== 'production' with safe dev fallbacks.
 */

export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

const DEV_PID_FALLBACK = 'modulajar-pid-dev-secret';

let cachedPidSecret: string | null = null;

/** PID signing secret; in production must be set (validated at startup). */
export function getPidSecret(): string {
    if (cachedPidSecret !== null) {
        return cachedPidSecret;
    }
    const v = process.env.PID_SECRET;
    if (v && v.length > 0) {
        cachedPidSecret = v;
        return v;
    }
    if (isProduction()) {
        throw new Error('PID_SECRET is required in production');
    }
    cachedPidSecret = DEV_PID_FALLBACK;
    return cachedPidSecret;
}

/** Exit if production is missing critical configuration. Call before listen(). */
export function assertProductionEnv(): void {
    if (!isProduction()) {
        return;
    }
    const missing: string[] = [];
    if (!process.env.DATABASE_URL?.trim()) {
        missing.push('DATABASE_URL');
    }
    if (!process.env.PID_SECRET?.trim()) {
        missing.push('PID_SECRET');
    }
    if (missing.length > 0) {
        console.error(`[FATAL] Missing required environment variables in production: ${missing.join(', ')}`);
        process.exit(1);
    }
}
