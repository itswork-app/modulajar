import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison: pads to equal width before timingSafeEqual
 * to avoid short-circuiting on length mismatch (see PR-036).
 */
export function constantTimeCompare(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    const maxLen = Math.max(aBuf.length, bBuf.length, 1);
    const pA = Buffer.alloc(maxLen, 0);
    const pB = Buffer.alloc(maxLen, 0);
    aBuf.copy(pA);
    bBuf.copy(pB);
    return timingSafeEqual(pA, pB) && aBuf.length === bBuf.length;
}
