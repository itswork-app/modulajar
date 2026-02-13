/**
 * sync_pack_to_db.ts
 *
 * Reads pack.json and upserts subjects + outcomes into DB.
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx ts-node scripts/sync_pack_to_db.ts
 *
 *   Dry-run (no DB required):
 *   DRY_RUN=1 npx ts-node scripts/sync_pack_to_db.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Outcome {
    code: string;
    description: string;
}

interface Subject {
    code: string;
    name: string;
    time_allocation?: {
        hours_per_week: number;
        weeks_per_semester: number;
    };
    outcomes: Outcome[];
}

interface CurriculumPack {
    pack_id: string;
    name: string;
    version: string;
    jenjang: string;
    kelas: string;
    subjects: Subject[];
}

const PACK_FILE = path.resolve(__dirname, '../../core-go/packs/merdeka/sd4/v1/pack.json');

function loadPack(): CurriculumPack {
    const raw = fs.readFileSync(PACK_FILE, 'utf-8');
    const pack: CurriculumPack = JSON.parse(raw);
    if (!pack.pack_id || !pack.subjects || pack.subjects.length === 0) {
        throw new Error('Invalid pack file');
    }
    return pack;
}

async function syncPackToDb() {
    const isDryRun = process.env.DRY_RUN === '1';
    const pack = loadPack();

    console.log(`\n📦 Pack Sync: ${pack.pack_id} ${isDryRun ? '(DRY RUN)' : ''}`);
    console.log('='.repeat(50));

    // Sort subjects by code for deterministic ordering
    const sortedSubjects = [...pack.subjects].sort((a, b) => a.code.localeCompare(b.code));

    if (isDryRun) {
        let totalOutcomes = 0;
        for (const subject of sortedSubjects) {
            const sortedOutcomes = [...subject.outcomes].sort((a, b) => a.code.localeCompare(b.code));
            console.log(`\n  📘 ${subject.code} — ${subject.name}`);
            console.log(`     Outcomes: ${sortedOutcomes.length}`);
            for (const o of sortedOutcomes) {
                console.log(`       ${o.code}: ${o.description.substring(0, 60)}...`);
            }
            totalOutcomes += sortedOutcomes.length;
        }
        console.log(`\n  ✅ Validated: ${sortedSubjects.length} subjects, ${totalOutcomes} outcomes (dry run)\n`);
        return;
    }

    // Require DATABASE_URL for actual sync
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('  ❌ DATABASE_URL not set. Use DRY_RUN=1 for validation only.');
        process.exit(1);
    }

    const { Pool } = await import('pg');
    const { ulid } = await import('ulid');
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

    try {
        // 1. Find the curriculum_pack_id
        const packResult = await pool.query(
            `SELECT id FROM curriculum_packs
             WHERE name = $1 AND version = $2 AND jenjang = $3 AND kelas = $4`,
            [pack.name, pack.version, pack.jenjang, pack.kelas]
        );

        if (packResult.rowCount === 0) {
            console.error('  ❌ Curriculum pack not found in DB. Run register_packs.ts first.');
            process.exit(1);
        }

        const curriculumPackId = packResult.rows[0].id;
        console.log(`  Pack DB ID: ${curriculumPackId}`);

        let subjectCount = 0;
        let outcomeCount = 0;

        for (const subject of sortedSubjects) {
            // Upsert subject by (curriculum_pack_id, code)
            const existingSubject = await pool.query(
                `SELECT id FROM subjects WHERE curriculum_pack_id = $1 AND code = $2`,
                [curriculumPackId, subject.code]
            );

            let subjectId: string;
            if (existingSubject.rowCount && existingSubject.rowCount > 0) {
                subjectId = existingSubject.rows[0].id;
                // Update name if changed
                await pool.query(
                    `UPDATE subjects SET name = $1 WHERE id = $2`,
                    [subject.name, subjectId]
                );
            } else {
                subjectId = ulid();
                await pool.query(
                    `INSERT INTO subjects (id, curriculum_pack_id, code, name) VALUES ($1, $2, $3, $4)`,
                    [subjectId, curriculumPackId, subject.code, subject.name]
                );
            }
            subjectCount++;

            // Sort outcomes by code for deterministic ordering
            const sortedOutcomes = [...subject.outcomes].sort((a, b) => a.code.localeCompare(b.code));

            for (const outcome of sortedOutcomes) {
                // Upsert outcome by (subject_id, code)
                const existingOutcome = await pool.query(
                    `SELECT id FROM outcomes WHERE subject_id = $1 AND code = $2`,
                    [subjectId, outcome.code]
                );

                if (existingOutcome.rowCount && existingOutcome.rowCount > 0) {
                    await pool.query(
                        `UPDATE outcomes SET description = $1 WHERE id = $2`,
                        [outcome.description, existingOutcome.rows[0].id]
                    );
                } else {
                    const outcomeId = ulid();
                    await pool.query(
                        `INSERT INTO outcomes (id, subject_id, code, description) VALUES ($1, $2, $3, $4)`,
                        [outcomeId, subjectId, outcome.code, outcome.description]
                    );
                }
                outcomeCount++;
            }

            console.log(`  ✅ ${subject.code}: ${sortedOutcomes.length} outcomes synced`);
        }

        console.log(`\n  ✨ Synced: ${subjectCount} subjects, ${outcomeCount} outcomes\n`);
    } finally {
        await pool.end();
    }
}

syncPackToDb().catch((err) => {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
});
