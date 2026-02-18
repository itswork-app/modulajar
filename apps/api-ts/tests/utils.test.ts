import tap from 'tap';
import { RateLimiter } from '../src/utils/rate-limit';
import { constantTimeCompare } from '../src/utils/crypto';

const test = tap.test;

test('RateLimiter', async (t) => {
    // Helper to mock Date.now()
    let now = 1000;
    const originalDateNow = Date.now;
    Date.now = () => now;

    t.teardown(() => {
        Date.now = originalDateNow;
    });

    await t.test('Basic Limiting', async (t) => {
        const limiter = new RateLimiter(1000, 2); // 1 sec window, 2 requests
        const ip = '1.1.1.1';

        t.equal(limiter.check(ip), true, 'First request allowed');
        t.equal(limiter.check(ip), true, 'Second request allowed');
        t.equal(limiter.check(ip), false, 'Third request blocked');

        // Different IP
        t.equal(limiter.check('2.2.2.2'), true, 'Other IP allowed');
    });

    await t.test('Window Reset', async (t) => {
        now = 2000; // time passed
        const limiter = new RateLimiter(1000, 1);
        const ip = '3.3.3.3';

        t.equal(limiter.check(ip), true, 'Req 1 allowed');
        t.equal(limiter.check(ip), false, 'Req 2 blocked');

        // Advance time by 1001ms
        now += 1001;
        t.equal(limiter.check(ip), true, 'Req 3 allowed after window reset');
    });

    await t.test('Cleanup', async (t) => {
        now = 5000;
        const limiter = new RateLimiter(1000, 1);

        // Add stale record
        limiter.check('stale');
        now += 2000; // 'stale' is now old

        // Add fresh record
        limiter.check('fresh');

        // Manually trigger cleanup
        limiter.cleanup();

        // Check internal state (accessing private map via any)
        const map = (limiter as any).requests as Map<string, any>;
        t.notOk(map.has('stale'), 'Stale record removed');
        t.ok(map.has('fresh'), 'Fresh record kept');
    });
});

test('Crypto Utilities', async (t) => {
    await t.test('constantTimeCompare', async (t) => {
        t.ok(constantTimeCompare('foo', 'foo'), 'Equal strings match');
        t.notOk(constantTimeCompare('foo', 'bar'), 'Different strings do not match');
        t.notOk(constantTimeCompare('foo', 'foobar'), 'Different lengths do not match');
        t.notOk(constantTimeCompare('foobar', 'foo'), 'Different lengths do not match (2)');
    });
});
