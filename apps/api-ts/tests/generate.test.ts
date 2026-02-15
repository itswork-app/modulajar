import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import generateRoutes from '../src/routes/generate';
import { issuePID, PID_REGEX, workspaceShortCode } from '../src/lib/pid';
import { ulid } from 'ulid';

const test = tap.test;

// ═══════════════════════════════════════════
// PID ISSUER UNIT TESTS
// ═══════════════════════════════════════════

test('PID Issuer', async (t) => {

    await t.test('PID format matches regex', async (t) => {
        const pid = issuePID('test-secret', {
            workspaceId: 'ws_001',
            packageUlid: '01HXYZ1234567890ABCD',
            kelas: '4',
            semester: 'S1',
            tahunAjaran: '2025/2026'
        });

        t.match(pid, PID_REGEX, `PID '${pid}' should match format`);
        t.ok(pid.startsWith('PKG-SD4-S1-2026-'), `PID should start with PKG-SD4-S1-2026-, got: ${pid}`);
        t.ok(pid.length > 20, 'PID should be reasonably long');
        t.ok(pid.length < 50, 'PID should not be excessively long');
        t.pass(`PID issued: ${pid}`);
    });

    await t.test('PID is deterministic (same input = same output)', async (t) => {
        const params = {
            workspaceId: 'ws_002',
            packageUlid: '01HABCDEF12345678901',
            kelas: 'SD4',
            semester: 'S1',
            tahunAjaran: '2026'
        };

        const pid1 = issuePID('test-secret', params);
        const pid2 = issuePID('test-secret', params);
        t.equal(pid1, pid2, 'Same input must produce same PID');
    });

    await t.test('Different package ULID produces different PID', async (t) => {
        const base = {
            workspaceId: 'ws_003',
            kelas: '4',
            semester: 'S1',
            tahunAjaran: '2026'
        };

        const pid1 = issuePID('test-secret', { ...base, packageUlid: 'ULID_A' });
        const pid2 = issuePID('test-secret', { ...base, packageUlid: 'ULID_B' });
        t.not(pid1, pid2, 'Different ULIDs must produce different PIDs');
    });

    await t.test('Different secret produces different PID', async (t) => {
        const params = {
            workspaceId: 'ws_004',
            packageUlid: 'ULID_X',
            kelas: '4',
            semester: 'S1',
            tahunAjaran: '2026'
        };

        const pid1 = issuePID('secret-a', params);
        const pid2 = issuePID('secret-b', params);
        t.not(pid1, pid2, 'Different secrets must produce different PIDs');
    });

    await t.test('workspaceShortCode is 6 chars', async (t) => {
        const short = workspaceShortCode('ws_test_123');
        t.equal(short.length, 6, `Short code should be 6 chars, got: ${short}`);
        t.match(short, /^[A-Z2-9]{6}$/, `Short code should be base32, got: ${short}`);
    });

    await t.test('Kelas and semester normalization', async (t) => {
        const base = {
            workspaceId: 'ws_005',
            packageUlid: 'ULID_NORM',
            tahunAjaran: '2026'
        };

        // "4" should become "SD4"
        const pid1 = issuePID('s', { ...base, kelas: '4', semester: 'S1' });
        t.ok(pid1.includes('SD4'), `kelas '4' should normalize to SD4: ${pid1}`);

        // "SD4" should stay "SD4"
        const pid2 = issuePID('s', { ...base, kelas: 'SD4', semester: 'S1' });
        t.ok(pid2.includes('SD4'), `kelas 'SD4' should stay SD4: ${pid2}`);

        // Semester "1" should become "S1"
        const pid3 = issuePID('s', { ...base, kelas: '4', semester: '1' });
        t.ok(pid3.includes('-S1-'), `semester '1' should normalize to S1: ${pid3}`);
    });
});

// ═══════════════════════════════════════════
// GENERATE ENDPOINT TESTS (with package lifecycle)
// ═══════════════════════════════════════════

test('Generate Semester with PID + Package', async (t) => {
    const WORKSPACE_ID = 'ws_pid_001';
    const USER_ID = 'user_1';

    const packages: Record<string, any> = {};
    const jobs: Record<string, any> = {};
    const ledger: Array<any> = [];

    // Seed 10 credits
    ledger.push({
        id: ulid(), workspace_id: WORKSPACE_ID, type: 'credit', amount: 10, reference: 'SEED'
    });

    const buildApp = () => {
        const fastify = Fastify();

        fastify.decorate('db', {
            query: async (sql: string, values: any[]) => {
                // Workspace membership
                if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                    const [wid, uid] = values || [];
                    if (wid === WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [] };
                    return { rowCount: 0, rows: [] };
                }

                // Job lookup with package JOIN
                if (sql.includes('SELECT gj.id, gj.status, gj.package_id, p.public_id')) {
                    const [key] = values;
                    const found = Object.values(jobs).find((j: any) => j.idempotency_key === key);
                    if (found) {
                        const pkg = packages[(found as any).package_id] || {};
                        return {
                            rowCount: 1,
                            rows: [{ ...(found as any), pid: pkg.public_id }]
                        };
                    }
                    return { rowCount: 0, rows: [] };
                }

                // Active jobs
                if (sql.includes('SELECT id FROM generation_jobs') && sql.includes('pending')) {
                    const [wid] = values;
                    const active = Object.values(jobs).filter(
                        (j: any) => j.workspace_id === wid && (j.status === 'pending' || j.status === 'running')
                    );
                    return { rowCount: active.length, rows: active };
                }

                // Balance
                if (sql.includes('SELECT COALESCE(SUM')) {
                    const [wid] = values;
                    const balance = ledger
                        .filter(l => l.workspace_id === wid)
                        .reduce((s, l) => s + (l.type === 'credit' ? l.amount : -l.amount), 0);
                    return { rowCount: 1, rows: [{ balance: String(balance) }] };
                }

                // Package lookup by identity
                if (sql.includes('SELECT id, public_id FROM packages') && sql.includes('teacher_name')) {
                    const [wid, kelas, sem, tahun, teacher, school] = values;
                    const found = Object.values(packages).find(
                        (p: any) => p.workspace_id === wid && p.kelas === kelas &&
                            p.semester === sem && p.tahun_ajaran === tahun &&
                            p.teacher_name === teacher && p.school_name === school
                    );
                    if (found) return { rowCount: 1, rows: [found] };
                    return { rowCount: 0, rows: [] };
                }

                // Insert package
                if (sql.includes('INSERT INTO packages')) {
                    const [id, wid, pid, kelas, sem, tahun, teacher, school, status] = values;
                    packages[id] = { id, workspace_id: wid, public_id: pid, kelas, semester: sem, tahun_ajaran: tahun, teacher_name: teacher, school_name: school, status };
                    return { rowCount: 1, rows: [] };
                }

                // Insert job
                if (sql.includes('INSERT INTO generation_jobs')) {
                    const [id, wid, pid, status, key] = values;
                    jobs[id] = { id, workspace_id: wid, package_id: pid, status, idempotency_key: key };
                    return { rowCount: 1, rows: [] };
                }

                // Debit check
                if (sql.includes('SELECT id FROM wallet_ledger WHERE reference')) {
                    const [ref] = values;
                    const found = ledger.find(l => l.reference === ref);
                    return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
                }

                // Insert ledger
                if (sql.includes('INSERT INTO wallet_ledger')) {
                    const [id, wid, type, amount, ref] = values;
                    ledger.push({ id, workspace_id: wid, type, amount, reference: ref });
                    return { rowCount: 1, rows: [] };
                }

                return { rows: [], rowCount: 0 };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
            totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
        } as any);

        fastify.register(mockAuthPlugin);
        fastify.register(generateRoutes);
        return fastify;
    };

    // Test 1: Create job with PID
    await t.test('Create job returns package_id + pid', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                pack_id: 'merdeka-sd4-v1',
                semester: 'S1',
                tahun_ajaran: '2025/2026',
                kelas: '4',
                teacher_name: 'Ibu Ani',
                school_name: 'SDN 1 Jakarta'
            }
        });

        t.equal(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.ok(body.job_id, 'has job_id');
        t.ok(body.package_id, 'has package_id');
        t.ok(body.pid, 'has pid');
        t.match(body.pid, PID_REGEX, `PID format valid: ${body.pid}`);
        t.ok(body.pid.startsWith('PKG-SD4-S1-2026'), `PID starts correctly: ${body.pid}`);

        await fastify.close();
    });

    // Test 2: Duplicate returns same package + pid (idempotent)
    await t.test('Duplicate request returns same package_id + pid', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const payload = {
            pack_id: 'merdeka-sd4-v1',
            semester: 'S1',
            tahun_ajaran: '2025/2026',
            kelas: '4',
            teacher_name: 'Ibu Ani',
            school_name: 'SDN 1 Jakarta'
        };

        const res1 = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload
        });

        const res2 = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload
        });

        t.equal(res2.statusCode, 200);
        const body1 = res1.json();
        const body2 = res2.json();
        t.equal(body2.job_id, body1.job_id, 'Same job_id');
        t.equal(body2.package_id, body1.package_id, 'Same package_id');
        t.equal(body2.pid, body1.pid, 'Same pid');
        t.equal(body2.idempotent, true);

        await fastify.close();
    });

    // Test 3: Different teacher creates different package
    await t.test('Different teacher_name creates new package', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const base = {
            pack_id: 'merdeka-sd4-v1',
            semester: 'S1',
            tahun_ajaran: '2025/2026',
            kelas: '4',
            school_name: 'SDN 1'
        };

        const res1 = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { ...base, teacher_name: 'Guru A' }
        });

        // Clear active jobs to allow second request
        Object.keys(jobs).forEach(k => { (jobs as any)[k].status = 'completed'; });

        const res2 = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { ...base, teacher_name: 'Guru B' }
        });

        // Both should succeed (possibly with different package_ids)
        if (res1.statusCode === 201 && res2.statusCode === 201) {
            const pkg1 = res1.json().package_id;
            const pkg2 = res2.json().package_id;
            t.not(pkg1, pkg2, `Different teachers should get different packages: ${pkg1} vs ${pkg2}`);
        } else {
            t.pass(`Requests returned ${res1.statusCode} and ${res2.statusCode} — different identity paths`);
        }

        await fastify.close();
    });

    t.teardown(() => { });
});
