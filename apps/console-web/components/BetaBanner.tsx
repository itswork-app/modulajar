'use client';

/**
 * Shows a top banner when NEXT_PUBLIC_BETA is "1" or "true" (build-time env).
 */
export function BetaBanner() {
    const enabled =
        process.env.NEXT_PUBLIC_BETA === '1' || process.env.NEXT_PUBLIC_BETA === 'true';
    if (!enabled) {
        return null;
    }
    return (
        <div
            role="status"
            className="sticky top-0 z-[100] w-full border-b border-amber-400/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
            <span className="font-semibold">Beta</span>
            {' — '}
            Fitur dapat berubah. Laporkan masalah ke tim dukungan Anda atau channel internal yang ditetapkan
            sekolah.
        </div>
    );
}
