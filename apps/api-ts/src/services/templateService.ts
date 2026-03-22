import { Pool } from 'pg';

// --- Jaccard Similarity (ported from core-go/curriculum/ranking/similarity.go) ---

function tokenize(text: string): Set<string> {
    return new Set(
        text.toLowerCase()
            .split(/[\s,.\-_\/]+/)
            .filter(t => t.length > 0)
    );
}

export function computeSimilarity(a: string, b: string): number {
    const setA = tokenize(a);
    const setB = tokenize(b);

    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersection = 0;
    for (const token of setA) {
        if (setB.has(token)) intersection++;
    }

    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0.0 : intersection / union;
}

// --- Ranking Score (ported from core-go/curriculum/ranking/score.go) ---

export function calculateScore(qualityScore: number, usageCount: number, similarity: number): number {
    const qualityNorm = Math.min(qualityScore, 100) / 100.0;
    const usageNorm = Math.min(usageCount, 50) / 50.0;
    const simNorm = Math.min(Math.max(similarity, 0), 1.0);

    return (qualityNorm * 0.6) + (usageNorm * 0.2) + (simNorm * 0.2);
}

// --- Preview Builder ---

export interface TemplatePreview {
    tujuan_pembelajaran: string;
    ringkasan_kegiatan: string;
    assessment_summary: string;
}

function truncate(text: string, maxLen: number = 200): string {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
}

export function buildPreview(moduleJson: any): TemplatePreview {
    const tujuan = moduleJson?.tujuan_pembelajaran || '';
    const kegiatan = moduleJson?.kegiatan_pembelajaran;
    const penilaian = moduleJson?.penilaian;

    // Tujuan: could be string or array
    const tujuanStr = Array.isArray(tujuan) ? tujuan.join('; ') : String(tujuan);

    // Kegiatan: summarize inti if object
    let kegiatanStr = '';
    if (typeof kegiatan === 'string') {
        kegiatanStr = kegiatan;
    } else if (kegiatan && typeof kegiatan === 'object') {
        kegiatanStr = kegiatan.inti || kegiatan.pendahuluan || '';
    }

    // Assessment: summarize
    let assessmentStr = '';
    if (typeof penilaian === 'string') {
        assessmentStr = penilaian;
    } else if (penilaian && typeof penilaian === 'object') {
        const parts = [penilaian.pengetahuan, penilaian.keterampilan, penilaian.sikap].filter(Boolean);
        assessmentStr = parts.join('; ');
    }

    return {
        tujuan_pembelajaran: truncate(tujuanStr),
        ringkasan_kegiatan: truncate(kegiatanStr),
        assessment_summary: truncate(assessmentStr),
    };
}

// --- Ranked Template ---

export interface RankedTemplateResult {
    id: string;
    subject: string;
    grade: number;
    topic: string;
    score: number;
    preview: TemplatePreview;
}

// --- Main Service ---

export async function fetchRankedTemplates(
    db: Pool,
    subject: string,
    grade: number,
    topic?: string
): Promise<RankedTemplateResult[]> {
    const result = await db.query(
        `SELECT id, subject, grade, topic, module_json, quality_score, usage_count
         FROM curriculum_dataset
         WHERE LOWER(subject) = LOWER($1) AND grade = $2
         ORDER BY quality_score DESC
         LIMIT 20`,
        [subject, grade]
    );

    if (result.rowCount === 0) {
        return [];
    }

    const targetTopic = topic || subject;

    // Rank candidates
    const ranked = result.rows.map((row: any) => {
        const similarity = computeSimilarity(targetTopic, row.topic || '');
        const score = calculateScore(row.quality_score || 0, row.usage_count || 0, similarity);

        let moduleJson: any = {};
        try {
            moduleJson = typeof row.module_json === 'string'
                ? JSON.parse(row.module_json)
                : row.module_json;
        } catch {
            // Invalid JSON — skip preview
        }

        return {
            id: row.id,
            subject: row.subject,
            grade: row.grade,
            topic: row.topic,
            score: Math.round(score * 100),
            preview: buildPreview(moduleJson),
        };
    });

    // Sort by score descending
    ranked.sort((a: RankedTemplateResult, b: RankedTemplateResult) => b.score - a.score);

    // Return top 3
    return ranked.slice(0, 3);
}
