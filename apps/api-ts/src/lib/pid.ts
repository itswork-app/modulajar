import { createHmac } from 'crypto';

/**
 * PID Issuer — generates canonical public IDs for packages.
 *
 * Format: PKG-{kelas}-{semester}-{tahun}-{workspaceShort}-{hmac8}
 * Example: PKG-SD4-S1-2026-WX82A9-K7F3Q8X2
 */

const BASE32_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 for readability

/**
 * Encode bytes to base32 (custom readable alphabet).
 */
function toBase32(buf: Buffer, length: number): string {
    let result = '';
    for (let i = 0; i < buf.length && result.length < length; i++) {
        result += BASE32_CHARS[buf[i] % BASE32_CHARS.length];
    }
    return result;
}

/**
 * Derive a deterministic 6-char workspace short code from workspace_id.
 */
export function workspaceShortCode(workspaceId: string): string {
    const hash = createHmac('sha256', 'workspace-short')
        .update(workspaceId)
        .digest();
    return toBase32(hash, 6);
}

/**
 * Issue a canonical PID for a package.
 *
 * @param secret PID signing secret (from env PID_SECRET)
 * @param params Package identity fields
 * @returns PID string e.g. PKG-SD4-S1-2026-WX82A9-K7F3Q8X2
 */
export function issuePID(
    secret: string,
    params: {
        workspaceId: string;
        packageUlid: string;
        kelas: string;
        semester: string;
        tahunAjaran: string;
    }
): string {
    const { workspaceId, packageUlid, kelas, semester, tahunAjaran } = params;

    // Extract year from tahun_ajaran (e.g. "2025/2026" -> "2026", "2026" -> "2026")
    const year = tahunAjaran.includes('/')
        ? tahunAjaran.split('/').pop()!
        : tahunAjaran;

    // Workspace short code (6 chars)
    const wsShort = workspaceShortCode(workspaceId);

    // HMAC suffix (8 chars)
    const payload = `${workspaceId}:${packageUlid}:${kelas}:${semester}:${tahunAjaran}`;
    const hmac = createHmac('sha256', secret).update(payload).digest();
    const suffix = toBase32(hmac, 8);

    // Kelas formatting: "4" -> "SD4", "SD4" -> "SD4"
    const kelasFormatted = kelas.toUpperCase().startsWith('SD')
        ? kelas.toUpperCase()
        : `SD${kelas}`;

    // Semester formatting: "S1" -> "S1", "1" -> "S1"
    const semFormatted = semester.toUpperCase().startsWith('S')
        ? semester.toUpperCase()
        : `S${semester}`;

    return `PKG-${kelasFormatted}-${semFormatted}-${year}-${wsShort}-${suffix}`;
}

/**
 * PID format regex for validation.
 * Example: PKG-SD4-S1-2026-WX82A9-K7F3Q8X2
 */
export const PID_REGEX = /^PKG-SD\d+-S\d+-\d{4}-[A-Z2-9]{6}-[A-Z2-9]{8}$/;
