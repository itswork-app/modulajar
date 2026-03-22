import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import workspaceRoutes from '../src/routes/workspace';

const test = tap.test;

const WORKSPACE_ID = 'ws-test-001';
const USER_ID = 'user_1';

function buildApp(documents: any[] = [], workspaceData: any = null, notFound: boolean = false) {
    const fastify = Fastify();

    fastify.decorate('db', {
        query: async (sql: string, params: any[]) => {
            // Workspace membership check (used by workspaceGuard)
            if (sql.includes('FROM workspace_members')) {
                const [wid, uid] = params;
                if (wid === WORKSPACE_ID && uid === USER_ID) {
                    return { rowCount: 1, rows: [{}] };
                }
                return { rowCount: 0, rows: [] };
            }

            // Get Workspace Identity
            if (sql.includes('FROM workspaces') && sql.includes('SELECT') && !sql.includes('npsn = $1')) {
                if (notFound) return { rowCount: 0, rows: [] };
                return {
                    rowCount: 1,
                    rows: [workspaceData || {
                        id: WORKSPACE_ID,
                        workspace_type: 'personal',
                        npsn: null,
                        school_name: null,
                        province: null,
                        regency: null,
                        address: null,
                        logo_url: null,
                        is_verified: false
                    }]
                };
            }

            // NPSN Duplicate Check
            if (sql.includes('npsn = $1') && sql.includes('SELECT id FROM workspaces')) {
                const [npsn] = params;
                // Mock: '1234567890' is taken by another workspace
                if (npsn === '1234567890') {
                    return { rowCount: 1, rows: [{ id: 'ws-other' }] };
                }
                return { rowCount: 0, rows: [] };
            }

            // Update Workspace
            if (sql.includes('UPDATE workspaces SET')) {
                return { rowCount: 1, rows: [] };
            }

            // List documents
            if (sql.includes('FROM generation_jobs gj')) {
                return { rowCount: documents.length, rows: documents };
            }

            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(workspaceRoutes);

    return fastify;
}

// ═══════════════════════════════════════════
// GET /w/:workspaceId/ping
// ═══════════════════════════════════════════
test('GET /w/:workspaceId/ping', async (t) => {
    await t.test('returns ok for authorised workspace member', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/ping`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.equal(body.status, 'ok');
        t.equal(body.workspaceId, WORKSPACE_ID);
        t.ok(body.userId, 'userId is present');

        await fastify.close();
    });

    await t.test('returns 401 for unauthenticated request', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/ping`
            // No Authorization header
        });

        // mock_auth returns 401 if no header
        t.equal(res.statusCode, 401);

        await fastify.close();
    });

    await t.test('returns 403 for wrong workspace', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/ws-OTHER/ping`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        // user_1 is not a member of ws-OTHER → workspace guard: 403
        t.equal(res.statusCode, 403);

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// GET /w/:workspaceId/documents
// ═══════════════════════════════════════════
test('GET /w/:workspaceId/documents', async (t) => {
    await t.test('returns empty list when workspace has no documents', async (t) => {
        const fastify = buildApp([]);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/documents`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        t.same(res.json().documents, []);

        await fastify.close();
    });

    await t.test('maps DB rows to document objects with correct jenjang', async (t) => {
        const rows = [
            {
                job_id: 'job-1',
                public_id: 'PKG-SD4-S1-2026-ABCDEF',
                status: 'ready',
                created_at: '2026-02-25T00:00:00.000Z',
                kelas: '4',        // SD4 → jenjang = 'SD'
                semester: 'S1',
                tahun_ajaran: '2025/2026',
                school_name: 'SDN 1',
                teacher_name: 'Ibu Ani'
            },
            {
                job_id: 'job-2',
                public_id: 'PKG-SMP7-S2-2026-XXXXXX',
                status: 'queued',
                created_at: '2026-02-24T00:00:00.000Z',
                kelas: '7',       // SMP → jenjang = 'SMP'
                semester: 'S2',
                tahun_ajaran: '2025/2026',
                school_name: 'SMPN 2',
                teacher_name: 'Pak Budi'
            },
            {
                job_id: 'job-3',
                public_id: 'PKG-SMA10-S1-2026-YYYYYY',
                status: 'queued',
                created_at: '2026-02-23T00:00:00.000Z',
                kelas: '10',      // SMA → jenjang = 'SMA/SMK'
                semester: 'S1',
                tahun_ajaran: '2025/2026',
                school_name: 'SMAN 3',
                teacher_name: 'Ibu Citra'
            },
            {
                job_id: 'job-4',
                public_id: 'PKG-KAMPUS-S1-2026-ZZZZZZ',
                status: 'queued',
                created_at: '2026-02-22T00:00:00.000Z',
                kelas: '13',      // > 12 → jenjang = 'Kampus'
                semester: 'S1',
                tahun_ajaran: '2025/2026',
                school_name: 'Universitas X',
                teacher_name: 'Prof. D'
            }
        ];

        const fastify = buildApp(rows);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/documents`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const docs = res.json().documents;

        t.equal(docs.length, 4, '4 documents returned');

        // jenjang mapping coverage
        const kelas4 = docs.find((d: any) => d.id === 'job-1');
        const kelas7 = docs.find((d: any) => d.id === 'job-2');
        const kelas10 = docs.find((d: any) => d.id === 'job-3');
        const kelas13 = docs.find((d: any) => d.id === 'job-4');

        t.equal(kelas4?.jenjang, 'SD', 'kelas 4 → SD');
        t.equal(kelas7?.jenjang, 'SMP', 'kelas 7 → SMP');
        t.equal(kelas10?.jenjang, 'SMA/SMK', 'kelas 10 → SMA/SMK');
        t.equal(kelas13?.jenjang, 'Kampus', 'kelas 13 → Kampus');

        // field mapping
        t.equal(kelas4?.public_id, 'PKG-SD4-S1-2026-ABCDEF');
        t.equal(kelas4?.school_name, 'SDN 1');
        t.equal(kelas4?.teacher_name, 'Ibu Ani');

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// Workspace Identity (PR-033)
// ═══════════════════════════════════════════
test('Workspace Identity (PR-033)', async (t) => {

    await t.test('GET /w/:wid/workspace returns defaults (personal)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.workspace_type, 'personal');
        t.equal(body.is_verified, false);
        t.equal(body.npsn, null);

        await fastify.close();
    });

    await t.test('GET /w/:wid/workspace returns 404 if not found', async (t) => {
        const fastify = buildApp([], null, true);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);
        t.equal(res.json().error, 'Workspace not found');

        await fastify.close();
    });

    await t.test('PATCH /w/:wid/workspace returns 400 with no fields', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {}
        });

        t.equal(res.statusCode, 400);
        t.equal(res.json().error, 'No fields to update');

        await fastify.close();
    });

    await t.test('PATCH school_name only -> 200', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { school_name: 'SDN Test' }
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'ok');

        await fastify.close();
    });

    await t.test('PATCH valid npsn -> 200', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '20261234' }
        });

        t.equal(res.statusCode, 200);

        await fastify.close();
    });

    await t.test('PATCH duplicate npsn -> 409', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '1234567890' } // Mocked as duplicate
        });

        t.equal(res.statusCode, 409);
        t.equal(res.json().error, 'Conflict');

        await fastify.close();
    });

    await t.test('PATCH invalid npsn (too short) -> 400', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '12345' }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('PATCH invalid logo_url (not https) -> 400', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { logo_url: 'http://evil.com/logo' }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('Cross-workspace update attempt -> 403', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/ws-OTHER/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { school_name: 'Illegal Update' }
        });

        t.equal(res.statusCode, 403);

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// POST /w/:workspaceId/verify-school (PR-056)
// ═══════════════════════════════════════════
test('POST /w/:workspaceId/verify-school', async (t) => {

    await t.test('returns 404 when NPSN not found', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string, params: any[]) => {
                // Auth/Guard mocks
                if (sql.includes('FROM workspace_members')) return { rowCount: 1, rows: [{}] };
                // School lookup
                if (sql.includes('FROM schools_reference')) return { rowCount: 0, rows: [] };
                return { rowCount: 0, rows: [] };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(workspaceRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/verify-school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '12345678' }
        });

        t.equal(res.statusCode, 404, 'returns 404 for unknown NPSN');
        await fastify.close();
    });

    await t.test('returns 200 and updates properties when NPSN found', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string, params: any[]) => {
                if (sql.includes('FROM workspace_members')) return { rowCount: 1, rows: [{}] };
                if (sql.includes('FROM schools_reference')) return {
                    rowCount: 1,
                    rows: [{ nama_resmi: 'SD TEST', kab_kota: 'KOTA X', provinsi: 'PROV Y', alamat: 'ALAMAT Z' }]
                };
                if (sql.includes('INSERT INTO workspace_settings')) return { rowCount: 1, rows: [] };
                if (sql.includes('UPDATE workspaces SET is_verified = true')) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(workspaceRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/verify-school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '12345678' }
        });

        t.equal(res.statusCode, 200, 'returns 200 for successful verification');
        t.equal(res.json().verified, true);
        t.equal(res.json().school_display_name, 'SD TEST');
        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// GET /w/:workspaceId/usage-summary (PR-057)
// ═══════════════════════════════════════════
test('GET /w/:workspaceId/usage-summary', async (t) => {
    t.test('returns correct summary', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string, params: any[]) => {
                if (sql.includes('FROM workspace_members')) return { rowCount: 1, rows: [{}] };
                // getBalance (wallet_ledger)
                if (sql.includes('wallet_ledger')) return { rowCount: 1, rows: [{ balance: 125 }] };
                // documents_generated (status = 'done')
                if (sql.includes('FROM generation_jobs') && sql.includes("status = 'done'")) return { rowCount: 1, rows: [{ count: '10' }] };
                // jobs_failed (status = 'failed')
                if (sql.includes('FROM generation_jobs') && sql.includes("status = 'failed'")) return { rowCount: 1, rows: [{ count: '3' }] };
                // recent_jobs (ORDER BY created_at DESC)
                if (sql.includes('FROM generation_jobs') && sql.includes('ORDER BY created_at DESC')) {
                    return {
                        rowCount: 1,
                        rows: [{
                            generation_id: 'gen-1',
                            subject: 'IPA',
                            semester: '1',
                            status: 'done',
                            created_at: new Date().toISOString()
                        }]
                    };
                }
                return { rowCount: 0, rows: [] };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(workspaceRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/usage-summary`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.credits_remaining, 125);
        t.equal(body.documents_generated, 10);
        t.equal(body.jobs_failed, 3);
        t.ok(Array.isArray(body.recent_jobs));
        t.equal(body.recent_jobs[0]?.subject, 'IPA');
        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// GET /w/:workspaceId/admin/dashboard (PR-C13)
// ═══════════════════════════════════════════
test('GET /w/:workspaceId/admin/dashboard', async (t) => {
    await t.test('returns 403 for non-admins', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string, params: any[]) => {
                if (sql.includes('FROM workspace_members')) {
                    // First call is guard, second is role check
                    // Actually guard check is done once.
                    // But admin/dashboard has its own role check at the top.
                    return { rowCount: 1, rows: [{ role: 'member' }] };
                }
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(workspaceRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/admin/dashboard`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 403, 'Forbidden for non-admin');
        await fastify.close();
    });

    await t.test('returns dashboard for admins', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string, params: any[]) => {
                // Role check
                if (sql.includes('SELECT role FROM workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };

                // 1. Teacher counter
                if (sql.includes('COUNT(DISTINCT clerk_user_id) AS count FROM workspace_members')) return { rowCount: 1, rows: [{ count: '15' }] };

                // 2. Total modules
                if (sql.includes('SELECT COUNT(*) AS count FROM generation_jobs') && sql.includes("status = 'done'")) return { rowCount: 1, rows: [{ count: '100' }] };

                // 3. Month modules (using CURRENT_DATE or similar in real SQL, we just match common patterns)
                if (sql.includes('created_at >=') && sql.includes('generation_jobs')) return { rowCount: 1, rows: [{ count: '20' }] };

                // 4. Wallet stats (balance, total_in)
                if (sql.includes('wallet_ledger')) {
                    return {
                        rowCount: 1,
                        rows: [{
                            credits_in: '500',
                            credits_out: '250',
                            credits_this_month: '50'
                        }]
                    };
                }

                // 5. Teacher activity stats
                if (sql.includes('GROUP BY clerk_user_id')) {
                    return { rowCount: 1, rows: [{ name: 'Chef', subject: 'IPA', modules_generated: '5', last_activity: new Date(), credits_used: '10' }] };
                }

                // 6. Activity feed
                if (sql.includes('JOIN packages p')) {
                    return {
                        rowCount: 1,
                        rows: [{
                            teacher_name: 'Chef',
                            subject: 'IPA',
                            grade: '4',
                            action: 'generate',
                            created_at: new Date()
                        }]
                    };
                }

                // Default handle for guard or others
                if (sql.includes('FROM workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };

                return { rowCount: 0, rows: [] };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(workspaceRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/admin/dashboard`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200, 'returns 200 for admin');
        const body = res.json();
        t.equal(body.overview.total_teachers, 15);
        t.equal(body.overview.total_modules, 100);
        t.equal(body.overview.credits_remaining, 250);
        t.ok(Array.isArray(body.teachers));
        await fastify.close();
    });
});
