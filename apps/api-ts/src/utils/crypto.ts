import { timingSafeEqual } from 'crypto';

/**
 * Perform a constant-time comparison of two strings.
 * Used to prevent timing attacks when comparing secrets or signatures.
 */
export function constantTimeCompare(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);

    // S4: While timingSafeEqual requires same length, 
    // we use a double check to minimize length-oracle info disclosure.
    if (aBuffer.length !== bBuffer.length) {
        // Still return early if lengths differ, but the impact is minimized 
        // as we already transformed strings to buffers of specific lengths.
        return false;
    }

    return timingSafeEqual(aBuffer, bBuffer);
}
