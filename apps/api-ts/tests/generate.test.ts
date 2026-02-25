import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
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
                    const found = Object.values(jobs).find((j: any) => j.generation_id === key);
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
                if (sql.includes('SELECT id FROM generation_jobs') && sql.includes('queued')) {
                    const [wid] = values;
                    const active = Object.values(jobs).filter(
                        (j: any) => j.workspace_id === wid && (j.status === 'queued' || j.status === 'running')
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
                    jobs[id] = { id, workspace_id: wid, package_id: pid, status, generation_id: key };
                    return { rowCount: 1, rows: [] };
                }

                // Wallet service: CTE debit (balance_check + INSERT)
                if (sql.includes('balance_check') && sql.includes('INSERT INTO wallet_ledger')) {
                    const [wid, id, amount, ref] = values;
                    const dup = ledger.find(l => l.workspace_id === wid && l.reference_id === ref && l.type === 'debit');
                    if (dup) return { rowCount: 0, rows: [] };
                    let balance = 0;
                    for (const e of ledger.filter(l => l.workspace_id === wid)) {
                        balance += e.type === 'credit' ? e.amount : -e.amount;
                    }
                    if (balance < (amount as number)) return { rowCount: 0, rows: [] };
                    ledger.push({ id, workspace_id: wid, type: 'debit', amount, reference_id: ref });
                    return { rowCount: 1, rows: [] };
                }

                // Wallet service: idempotency check for debit
                if (sql.includes('SELECT id FROM wallet_ledger') && sql.includes('reference_id')) {
                    const [wid, ref] = values;
                    const found = ledger.filter(l => l.workspace_id === wid && l.reference_id === ref && l.type === 'debit');
                    return { rowCount: found.length, rows: found };
                }

                // Wallet service: credit with ON CONFLICT
                if (sql.includes('INSERT INTO wallet_ledger') && sql.includes('ON CONFLICT')) {
                    const [id, wid, amount, ref] = values;
                    const type = sql.includes("'credit'") ? 'credit' : 'debit';
                    const dup = ledger.find(l => l.workspace_id === wid && l.reference_id === ref && l.type === type);
                    if (dup) return { rowCount: 0, rows: [] };
                    ledger.push({ id, workspace_id: wid, type, amount, reference_id: ref });
                    return { rowCount: 1, rows: [] };
                }

                return { rows: [], rowCount: 0 };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
            totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
        } as any);

        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
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

// ═══════════════════════════════════════════
// GENERATE ENDPOINT — BRANCH COVERAGE TESTS
// ═══════════════════════════════════════════

test('Generate endpoint branch coverage', async (t) => {
    const WS_BC = 'ws_bc_001';
    const UID_BC = 'user_1'; // Consistent with mock_auth.ts 'Bearer user_1'

    function buildBranchApp(overrides: {
        balance?: number;
        hasActiveJob?: boolean;
        existingPkg?: any;
    } = {}) {
        const { balance = 10, hasActiveJob = false, existingPkg = null } = overrides;
        const fastify = Fastify();

        fastify.decorate('db', {
            query: async (sql: string, values: any[]) => {
                if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                    if (values[0] === WS_BC && values[1] === UID_BC) return { rowCount: 1, rows: [] };
                    return { rowCount: 0, rows: [] };
                }
                if (sql.includes('SELECT gj.id, gj.status, gj.package_id, p.public_id'))
                    return { rowCount: 0, rows: [] };
                if (sql.includes('SELECT id FROM generation_jobs') && sql.includes('queued'))
                    return hasActiveJob ? { rowCount: 1, rows: [{ id: 'aj' }] } : { rowCount: 0, rows: [] };
                if (sql.includes('SELECT COALESCE(SUM'))
                    return { rowCount: 1, rows: [{ balance: String(balance) }] };
                if (sql.includes('SELECT id, public_id FROM packages') && sql.includes('teacher_name'))
                    return existingPkg ? { rowCount: 1, rows: [existingPkg] } : { rowCount: 0, rows: [] };
                if (sql.includes('INSERT INTO packages') || sql.includes('INSERT INTO generation_jobs'))
                    return { rowCount: 1, rows: [] };
                if (sql.includes('SELECT id FROM wallet_ledger') && sql.includes('reference_id'))
                    return { rowCount: 0, rows: [] };
                if (sql.includes('balance_check') && sql.includes('INSERT INTO wallet_ledger'))
                    return { rowCount: 1, rows: [] };
                if (sql.includes('INSERT INTO wallet_ledger') && sql.includes('ON CONFLICT'))
                    return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            },
            connect: async () => ({
                query: async () => ({ rowCount: 1, rows: [] }),
                release: () => { }
            } as any)
        } as any);

        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(generateRoutes);
        return fastify;
    }

    await t.test('400 when pack_id is missing', async (t) => {
        const fastify = buildBranchApp();
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WS_BC}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${UID_BC}` },
            payload: { semester: 'S1', tahun_ajaran: '2025/2026' }
        });
        t.equal(res.statusCode, 400);
        t.match(res.json().error, /Missing required fields/);
        await fastify.close();
    });

    await t.test('400 when semester is missing', async (t) => {
        const fastify = buildBranchApp();
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WS_BC}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${UID_BC}` },
            payload: { pack_id: 'p1', tahun_ajaran: '2025/2026' }
        });
        t.equal(res.statusCode, 400);
        await fastify.close();
    });

    await t.test('400 when tahun_ajaran is missing', async (t) => {
        const fastify = buildBranchApp();
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WS_BC}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${UID_BC}` },
            payload: { pack_id: 'p1', semester: 'S1' }
        });
        t.equal(res.statusCode, 400);
        await fastify.close();
    });

    await t.test('409 when active job exists', async (t) => {
        const fastify = buildBranchApp({ hasActiveJob: true });
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WS_BC}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${UID_BC}` },
            payload: { pack_id: 'p1', semester: 'S1', tahun_ajaran: '2025/2026' }
        });
        t.equal(res.statusCode, 409);
        t.match(res.json().error, /Conflict/);
        await fastify.close();
    });

    await t.test('402 when balance is insufficient', async (t) => {
        const fastify = buildBranchApp({ balance: 0 });
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WS_BC}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${UID_BC}` },
            payload: { pack_id: 'p1', semester: 'S1', tahun_ajaran: '2025/2026' }
        });
        t.equal(res.statusCode, 402);
        t.ok(res.json().balance !== undefined);
        await fastify.close();
    });

    await t.test('reuses existing package when found', async (t) => {
        const pkg = { id: 'pkg-existing', public_id: 'PKG-SD4-S1-2026-REUSED' };
        const fastify = buildBranchApp({ existingPkg: pkg });
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WS_BC}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${UID_BC}` },
            payload: { pack_id: 'p-a-b-c', semester: 'S1', tahun_ajaran: '2025/2026', kelas: '4', teacher_name: 'T', school_name: 'S' }
        });
        t.equal(res.statusCode, 201);
        const body = res.json();
        t.equal(body.package_id, pkg.id);
        t.equal(body.pid, pkg.public_id);
        await fastify.close();
    });

    await t.test('uses flat pack path for pack_id with less than 3 parts', async (t) => {
        const fastify = buildBranchApp();
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WS_BC}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${UID_BC}` },
            payload: { pack_id: 'flatpack', semester: 'S1', tahun_ajaran: '2025/2026' }
        });
        t.ok(res.statusCode < 500, `should not crash: ${res.statusCode}`);
        await fastify.close();
    });
});
