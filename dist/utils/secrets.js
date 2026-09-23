import { timingSafeEqual } from 'node:crypto';
/**
 * Constant-time comparison of two secrets.
 *
 * A plain `a === b` short-circuits on the first differing byte, leaking
 * length and prefix information through timing. Inputs of differing length
 * are rejected up front (timingSafeEqual throws on length mismatch), but
 * only after both have been read, so length is not itself a timing oracle
 * for the shared-secret sizes in use here.
 */
export function safeEqual(a, b) {
    if (!a || !b)
        return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length)
        return false;
    return timingSafeEqual(bufA, bufB);
}
//# sourceMappingURL=secrets.js.map