import { timingSafeEqual } from 'crypto';

/**
 * Perform a constant-time comparison of two strings.
 * Used to prevent timing attacks when comparing secrets or signatures.
 */
export function constantTimeCompare(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);

    if (aBuffer.length !== bBuffer.length) {
        return false;
    }

    return timingSafeEqual(aBuffer, bBuffer);
}
