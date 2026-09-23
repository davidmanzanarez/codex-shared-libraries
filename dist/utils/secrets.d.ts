/**
 * Constant-time comparison of two secrets.
 *
 * A plain `a === b` short-circuits on the first differing byte, leaking
 * length and prefix information through timing. Inputs of differing length
 * are rejected up front (timingSafeEqual throws on length mismatch), but
 * only after both have been read, so length is not itself a timing oracle
 * for the shared-secret sizes in use here.
 */
export declare function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean;
//# sourceMappingURL=secrets.d.ts.map