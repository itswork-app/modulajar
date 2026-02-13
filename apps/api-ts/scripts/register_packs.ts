/**
 * register_packs.ts
 * 
 * CLI script to register curriculum packs into the curriculum_packs DB table.
 * Idempotent: upserts by (name + version + jenjang + kelas).
 * 
 * Usage:
 *   DATABASE_URL=postgres://... npx ts-node scripts/register_packs.ts
 *   
 *   Dry-run (no DB required):
 *   DRY_RUN=1 npx ts-node scripts/register_packs.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Subject {
    code: string;
    name: string;
    time_allocation?: {
        hours_per_week: number;
        weeks_per_semester: number;
    };
    outcomes?: Array<{ code: string; description: string }>;
}

interface CurriculumPack {
    pack_id: string;
    name: string;
    version: string;
    jenjang: string;
    kelas: string;
    subjects: Subject[];
}

// Pack files to register
const PACK_FILES = [
    path.resolve(__dirname, '../../core-go/packs/merdeka/sd4/v1/pack.json'),
];

function loadPack(filePath: string): CurriculumPack {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const pack: CurriculumPack = JSON.parse(raw);

    // Validate required fields
    if (!pack.pack_id) throw new Error(`Missing pack_id in ${filePath}`);
    if (!pack.name) throw new Error(`Missing name in ${filePath}`);
    if (!pack.version) throw new Error(`Missing version in ${filePath}`);
    if (!pack.jenjang) throw new Error(`Missing jenjang in ${filePath}`);
    if (!pack.kelas) throw new Error(`Missing kelas in ${filePath}`);
    if (!pack.subjects || pack.subjects.length === 0) {
        throw new Error(`subjects must not be empty in ${filePath}`);
    }

    return pack;
}

async function registerPacks() {
    const isDryRun = process.env.DRY_RUN === '1';

    console.log(`\n📦 Curriculum Pack Registration ${isDryRun ? '(DRY RUN)' : ''}`);
    console.log('='.repeat(50));

    for (const filePath of PACK_FILES) {
        const pack = loadPack(filePath);
        console.log(`\n  Pack: ${pack.pack_id}`);
        console.log(`  Name: ${pack.name}`);
        console.log(`  Version: ${pack.version}`);
        console.log(`  Jenjang: ${pack.jenjang}, Kelas: ${pack.kelas}`);
        console.log(`  Subjects: ${pack.subjects.map(s => s.code).join(', ')}`);

        if (isDryRun) {
            console.log('  ✅ Validated (dry run, no DB write)');
            continue;
        }

        // Require DATABASE_URL for actual registration
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            console.error('  ❌ DATABASE_URL not set. Use DRY_RUN=1 for validation only.');
            process.exit(1);
        }

        // Dynamic import pg only when needed
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

        try {
            const { ulid } = await import('ulid');
            const id = ulid();

            // Upsert by name + version + jenjang + kelas
            const result = await pool.query(
                `INSERT INTO curriculum_packs (id, name, version, jenjang, kelas, status)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT ON CONSTRAINT curriculum_packs_unique_pack
                 DO UPDATE SET status = EXCLUDED.status
                 RETURNING id`,
                [id, pack.name, pack.version, pack.jenjang, pack.kelas, 'active']
            );

            console.log(`  ✅ Registered (id: ${result.rows[0].id})`);
        } catch (err: any) {
            // If unique constraint doesn't exist yet, try simple upsert
            if (err.code === '42704' || err.message?.includes('constraint')) {
                console.log('  ⚠️  Unique constraint not found, attempting plain insert...');
                const { ulid } = await import('ulid');
                const pool2 = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
                try {
                    // Check if already exists
                    const check = await pool2.query(
                        `SELECT id FROM curriculum_packs 
                         WHERE name = $1 AND version = $2 AND jenjang = $3 AND kelas = $4`,
                        [pack.name, pack.version, pack.jenjang, pack.kelas]
                    );
                    if (check.rowCount && check.rowCount > 0) {
                        console.log(`  ✅ Already exists (id: ${check.rows[0].id})`);
                    } else {
                        const id = ulid();
                        await pool2.query(
                            `INSERT INTO curriculum_packs (id, name, version, jenjang, kelas, status)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [id, pack.name, pack.version, pack.jenjang, pack.kelas, 'active']
                        );
                        console.log(`  ✅ Inserted (id: ${id})`);
                    }
                } finally {
                    await pool2.end();
                }
            } else {
                throw err;
            }
        } finally {
            await pool.end();
        }
    }

    console.log('\n✨ Done.\n');
}

registerPacks().catch((err) => {
    console.error('❌ Registration failed:', err.message);
    process.exit(1);
});
