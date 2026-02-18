export class RateLimiter {
    private requests: Map<string, { count: number; windowStart: number }>;
    private windowMs: number;
    private limit: number;

    constructor(windowMs: number, limit: number) {
        this.requests = new Map();
        this.windowMs = windowMs;
        this.limit = limit;

        // Cleanup every minute to prevent memory leak
        setInterval(() => this.cleanup(), 60000);
    }

    check(key: string): boolean {
        const now = Date.now();
        const record = this.requests.get(key);

        if (!record) {
            this.requests.set(key, { count: 1, windowStart: now });
            return true;
        }

        if (now - record.windowStart > this.windowMs) {
            // New window
            this.requests.set(key, { count: 1, windowStart: now });
            return true;
        }

        if (record.count >= this.limit) {
            return false;
        }

        record.count++;
        return true;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.requests.entries()) {
            if (now - record.windowStart > this.windowMs) {
                this.requests.delete(key);
            }
        }
    }
}
