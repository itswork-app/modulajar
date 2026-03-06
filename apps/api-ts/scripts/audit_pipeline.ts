/**
 * Production Capability Audit — Direct Worker Pipeline Test
 * 
 * Bypasses the API layer (which has auth, wallet, teacher context dependencies)
 * and directly seeds a generation job in the DB, then invokes the worker.
 * 
 * This tests the CRITICAL production path:
 *   Gemini AI → Curriculum JSON → HTML Render → Chromedp PDF → GCS Upload → DB Persist
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { ulid } from 'ulid';

dotenv.config();

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8080';
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL });

const WORKSPACE_ID = 'test-ws-01';

// Pad to CHAR(26) to match database column type
function pad26(s: string): string {
    return s.padEnd(26, ' ');
}

async function seedAndRun() {
    console.log('🚀 Production Capability Audit — Direct Worker Test');
    console.log('============================================================');

    const packageId = ulid();
    const jobId = ulid();
    const pid = `PID-AUDIT-${Date.now()}`;
    const idempotencyKey = `audit-${Date.now()}`;

    // ── Phase 0: Seed DB ──────────────────────────────────────────────
    console.log('\n--- Phase 0: Seeding DB with Package + Job ---');

    // Insert package
    await pool.query(
        `INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status)
         VALUES ($1, $2, $3, '4', '1', '2025/2026', 'Budi Utomo', 'SD Negeri 1 Jakarta', 'draft')`,
        [pad26(packageId), pad26(WORKSPACE_ID), pid]
    );
    console.log(`✅ Package created: ${packageId} (PID: ${pid})`);

    // Build metadata matching TaskPayload
    const metadata = {
        job_id: jobId,
        package_id: packageId,
        workspace_id: WORKSPACE_ID,
        pack_path: 'packs/wizard/wizard/pack.json',
        mode: 'wizard',
        topic: 'pecahan sederhana',
        subject: 'matematika',
        grade: 4,
        semester: '1',
        kelas: '4',
        tahun_ajaran: '2025/2026',
        teacher_name: 'Budi Utomo',
        school_name: 'SD Negeri 1 Jakarta',
        pid: pid,
        trace_id: `audit-trace-${Date.now()}`
    };

    // Insert generation job
    await pool.query(
        `INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, metadata, attempt_count, next_run_at)
         VALUES ($1, $2, $3, 'queued', $4, $5, 0, NOW())`,
        [pad26(jobId), pad26(WORKSPACE_ID), pad26(packageId), idempotencyKey, JSON.stringify(metadata)]
    );
    console.log(`✅ Job queued: ${jobId}`);

    // ── Phase 1: Trigger Worker ───────────────────────────────────────
    console.log('\n--- Phase 1: Triggering Worker ---');
    try {
        const resp = await fetch(`${WORKER_URL}/tasks/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: jobId })
        });
        const text = await resp.text();
        console.log(`Worker response (${resp.status}): ${text.substring(0, 500)}`);

        if (resp.status !== 200) {
            console.error('❌ Worker returned non-200 status');
        } else {
            console.log('✅ Worker completed processing');

            // Try to parse as JSON for details
            try {
                const result = JSON.parse(text);
                if (result.status === 'completed') {
                    console.log('✅ Job status: completed');
                    if (result.rendered_documents) {
                        for (const doc of result.rendered_documents) {
                            console.log(`   📄 Document: ${doc.document_id}, PDF size: ${doc.pdf_size_bytes} bytes, PDF hash: ${doc.pdf_hash}`);
                        }
                    }
                } else {
                    console.error(`❌ Job status: ${result.status}, reason: ${result.failure_reason}`);
                }
            } catch { /* text response, not JSON */ }
        }
    } catch (err: any) {
        console.error('❌ Worker request failed:', err.message);
    }

    // ── Phase 2: Verify DB State ──────────────────────────────────────
    console.log('\n--- Phase 2: Verifying Database State ---');

    // Check job status
    const jobResult = await pool.query(
        'SELECT status, metadata, last_error, attempt_count FROM generation_jobs WHERE id = $1',
        [pad26(jobId)]
    );
    if (jobResult.rowCount && jobResult.rowCount > 0) {
        const job = jobResult.rows[0];
        console.log(`Job status: ${job.status}, attempts: ${job.attempt_count}`);
        if (job.last_error) console.log(`   Last error: ${job.last_error}`);
        if (job.status === 'done') console.log('✅ Job marked as done in DB');
        else console.error(`❌ Job status is ${job.status}, expected 'done'`);
    }

    // Check package status
    const pkgResult = await pool.query(
        'SELECT status FROM packages WHERE id = $1',
        [pad26(packageId)]
    );
    if (pkgResult.rowCount && pkgResult.rowCount > 0) {
        const pkg = pkgResult.rows[0];
        console.log(`Package status: ${pkg.status}`);
        if (pkg.status === 'ready') console.log('✅ Package marked as ready');
        else console.error(`❌ Package status is ${pkg.status}, expected 'ready'`);
    }

    // Check documents
    const docsResult = await pool.query(
        'SELECT id, public_id, status, subject_code FROM documents WHERE package_id = $1',
        [pad26(packageId)]
    );
    if (docsResult.rowCount && docsResult.rowCount > 0) {
        console.log(`✅ ${docsResult.rowCount} document(s) created`);
        for (const doc of docsResult.rows) {
            console.log(`   📄 Doc ${doc.id}: status=${doc.status}, subject=${doc.subject_code}, DID=${doc.public_id}`);
        }
    } else {
        console.error('❌ No documents found for this package');
    }

    // ── Phase 3: Summary ──────────────────────────────────────────────
    console.log('\n============================================================');
    console.log('🏁 Audit Summary:');

    const finalJobStatus = jobResult.rows[0]?.status;
    const finalPkgStatus = pkgResult.rows[0]?.status;
    const docCount = docsResult.rowCount || 0;

    const checks = [
        { name: 'Job completed', pass: finalJobStatus === 'done' },
        { name: 'Package ready', pass: finalPkgStatus === 'ready' },
        { name: 'Documents created', pass: docCount > 0 },
    ];

    let allPass = true;
    for (const c of checks) {
        console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`);
        if (!c.pass) allPass = false;
    }

    if (allPass) {
        console.log('\n🎉 ALL CHECKS PASSED — Pipeline is production-ready!');
    } else {
        console.log('\n⚠️  SOME CHECKS FAILED — Review output above');
    }

    await pool.end();
}

seedAndRun().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
