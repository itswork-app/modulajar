import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import templateRoutes from '../src/routes/templates';
import {
    computeSimilarity,
    calculateScore,
    buildPreview,
    fetchRankedTemplates,
} from '../src/services/templateService';

const test = tap.test;

const WORKSPACE_ID = 'ws_tmpl_001';
const USER_ID = 'user_1';

const SAMPLE_MODULE_JSON = {
    tujuan_pembelajaran: 'Siswa dapat membandingkan dua pecahan.',
    kegiatan_pembelajaran: {
        pendahuluan: 'Guru menyapa siswa.',
        inti: 'Siswa melakukan eksplorasi dengan benda konkret.',
        penutup: 'Guru memberikan kesimpulan.',
    },
    penilaian: {
        sikap: 'Observasi selama diskusi.',
        pengetahuan: 'Tes tertulis membandingkan pecahan.',
        keterampilan: 'Unjuk kerja.',
    },
};

// ═══════════════════════════════════════════
// UNIT TESTS — Service Layer
// ═══════════════════════════════════════════

test('computeSimilarity', async (t) => {

    await t.test('identical strings return 1.0', async (t) => {
        t.equal(computeSimilarity('pecahan', 'pecahan'), 1.0);
    });

    await t.test('completely different strings return 0.0', async (t) => {
        t.equal(computeSimilarity('pecahan', 'geografi'), 0.0);
    });

    await t.test('partial overlap returns between 0 and 1', async (t) => {
        const score = computeSimilarity('pecahan biasa', 'pecahan campuran');
        t.ok(score > 0 && score < 1, `Score should be between 0 and 1, got ${score}`);
    });

    await t.test('empty strings both return 1.0', async (t) => {
        t.equal(computeSimilarity('', ''), 1.0);
    });

    await t.test('one empty string returns 0.0', async (t) => {
        t.equal(computeSimilarity('pecahan', ''), 0.0);
    });
});

test('calculateScore', async (t) => {

    await t.test('perfect scores return 1.0', async (t) => {
        const score = calculateScore(100, 50, 1.0);
        t.equal(score, 1.0);
    });

    await t.test('zero scores return 0.0', async (t) => {
        const score = calculateScore(0, 0, 0.0);
        t.equal(score, 0.0);
    });

    await t.test('quality has most weight', async (t) => {
        const highQuality = calculateScore(100, 0, 0);
        const highUsage = calculateScore(0, 50, 0);
        t.ok(highQuality > highUsage, 'Quality weight > usage weight');
    });

    await t.test('values are clamped', async (t) => {
        const score = calculateScore(200, 100, 2.0);
        t.equal(score, 1.0, 'Score capped at 1.0');
    });
});

test('buildPreview', async (t) => {

    await t.test('extracts fields correctly', async (t) => {
        const preview = buildPreview(SAMPLE_MODULE_JSON);
        t.ok(preview.tujuan_pembelajaran.length > 0, 'has tujuan');
        t.ok(preview.ringkasan_kegiatan.length > 0, 'has kegiatan');
        t.ok(preview.assessment_summary.length > 0, 'has assessment');
    });

    await t.test('truncates long fields to 200 chars', async (t) => {
        const longModule = {
            tujuan_pembelajaran: 'A'.repeat(300),
            kegiatan_pembelajaran: { inti: 'B'.repeat(300) },
            penilaian: { pengetahuan: 'C'.repeat(300) },
        };
        const preview = buildPreview(longModule);
        t.ok(preview.tujuan_pembelajaran.length <= 200, `Tujuan truncated: ${preview.tujuan_pembelajaran.length}`);
        t.ok(preview.ringkasan_kegiatan.length <= 200, `Kegiatan truncated: ${preview.ringkasan_kegiatan.length}`);
        t.ok(preview.assessment_summary.length <= 200, `Assessment truncated: ${preview.assessment_summary.length}`);
    });

    await t.test('handles array tujuan_pembelajaran', async (t) => {
        const preview = buildPreview({
            tujuan_pembelajaran: ['Goal A', 'Goal B'],
        });
        t.ok(preview.tujuan_pembelajaran.includes('Goal A'));
        t.ok(preview.tujuan_pembelajaran.includes('Goal B'));
    });

    await t.test('handles empty/null input', async (t) => {
        const preview = buildPreview({});
        t.equal(preview.tujuan_pembelajaran, '');
        t.equal(preview.ringkasan_kegiatan, '');
        t.equal(preview.assessment_summary, '');
    });

    await t.test('handles string kegiatan', async (t) => {
        const preview = buildPreview({
            kegiatan_pembelajaran: 'Aktivitas langsung',
        });
        t.equal(preview.ringkasan_kegiatan, 'Aktivitas langsung');
    });

    await t.test('handles string penilaian', async (t) => {
        const preview = buildPreview({
            penilaian: 'Tes tertulis dan praktik',
        });
        t.equal(preview.assessment_summary, 'Tes tertulis dan praktik');
    });
});

// ═══════════════════════════════════════════
// ENDPOINT TESTS
// ═══════════════════════════════════════════

function buildApp(datasetRows: any[] = []) {
    const fastify = Fastify();

    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            // Workspace membership check
            if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                const [wid, uid] = values || [];
                if (wid === WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }

            // Dataset query
            if (sql.includes('curriculum_dataset')) {
                return { rowCount: datasetRows.length, rows: datasetRows };
            }

            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({
            query: async () => ({ rowCount: 1, rows: [] }),
            release: () => { }
        } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(templateRoutes);
    return fastify;
}

const sampleDataset = [
    {
        id: 'tmpl-001',
        subject: 'matematika',
        grade: 4,
        topic: 'pecahan',
        module_json: JSON.stringify(SAMPLE_MODULE_JSON),
        quality_score: 92,
        usage_count: 5,
    },
    {
        id: 'tmpl-002',
        subject: 'matematika',
        grade: 4,
        topic: 'bilangan bulat',
        module_json: JSON.stringify({
            tujuan_pembelajaran: 'Siswa memahami bilangan bulat.',
            kegiatan_pembelajaran: { inti: 'Latihan soal.' },
            penilaian: { pengetahuan: 'Quiz.' },
        }),
        quality_score: 88,
        usage_count: 3,
    },
];

test('GET /templates/recommended', async (t) => {

    await t.test('200 — returns ranked templates', async (t) => {
        const fastify = buildApp(sampleDataset);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=4&topic=pecahan`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.ok(Array.isArray(body.templates), 'templates is array');
        t.ok(body.templates.length > 0, 'has templates');
        t.ok(body.templates.length <= 3, 'max 3 templates');

        // Validate structure
        const tmpl = body.templates[0];
        t.ok(tmpl.id, 'has id');
        t.ok(tmpl.subject, 'has subject');
        t.ok(typeof tmpl.grade === 'number', 'grade is number');
        t.ok(typeof tmpl.score === 'number', 'score is number');
        t.ok(tmpl.preview, 'has preview');
        t.ok(tmpl.preview.tujuan_pembelajaran !== undefined, 'preview has tujuan');

        await fastify.close();
    });

    await t.test('200 — empty dataset returns empty array', async (t) => {
        const fastify = buildApp([]);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=fisika&grade=10`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        t.same(res.json().templates, []);

        await fastify.close();
    });

    await t.test('400 — missing subject', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?grade=4`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /subject/);

        await fastify.close();
    });

    await t.test('400 — missing grade', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /grade/);

        await fastify.close();
    });

    await t.test('400 — invalid grade (0)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=0`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /Invalid grade/);

        await fastify.close();
    });

    await t.test('400 — invalid grade (13)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=13`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /Invalid grade/);

        await fastify.close();
    });

    await t.test('400 — grade is not a number', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=abc`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('module_json is never exposed in response', async (t) => {
        const fastify = buildApp(sampleDataset);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=4`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        const raw = res.body;
        t.notOk(raw.includes('module_json'), 'module_json must not appear in response');

        await fastify.close();
    });

    await t.test('401 — no auth header', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=4`,
        });

        t.equal(res.statusCode, 401);

        await fastify.close();
    });

    await t.test('200 — topic is optional', async (t) => {
        const fastify = buildApp(sampleDataset);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=4`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        t.ok(Array.isArray(res.json().templates));

        await fastify.close();
    });

    await t.test('templates are sorted by score descending', async (t) => {
        const fastify = buildApp(sampleDataset);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=4&topic=pecahan`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        const templates = res.json().templates;
        for (let i = 1; i < templates.length; i++) {
            t.ok(templates[i - 1].score >= templates[i].score, 'Sorted by score desc');
        }

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// INVALID JSON HANDLING TEST
// ═══════════════════════════════════════════

test('GET /templates/recommended — invalid JSON in module_json', async (t) => {
    const fastify = buildApp([{
        id: 'tmpl-bad',
        subject: 'matematika',
        grade: 4,
        topic: 'pecahan',
        module_json: '{invalid-json',
        quality_score: 80,
        usage_count: 2,
    }]);
    await fastify.ready();

    const res = await fastify.inject({
        method: 'GET',
        url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=4`,
        headers: { Authorization: `Bearer ${USER_ID}` },
    });

    t.equal(res.statusCode, 200);
    const templates = res.json().templates;
    t.ok(Array.isArray(templates));
    t.equal(templates[0].preview.tujuan_pembelajaran, '');

    await fastify.close();
});

// ═══════════════════════════════════════════
// RATE LIMITING TEST
// ═══════════════════════════════════════════

test('Rate limiting', async (t) => {

    await t.test('429 after exceeding limit', async (t) => {
        const fastify = buildApp(sampleDataset);
        await fastify.ready();

        // Send 61 requests (limit is 60)
        let lastRes: any;
        for (let i = 0; i < 61; i++) {
            lastRes = await fastify.inject({
                method: 'GET',
                url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=4`,
                headers: { Authorization: `Bearer ${USER_ID}` },
            });
        }

        t.equal(lastRes.statusCode, 429, 'Should be rate limited');
        t.match(lastRes.json().error, /Too Many Requests/);

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// NEW CRUD ENDPOINTS TESTS (PR-C15)
// ═══════════════════════════════════════════

test('GET /w/:workspaceId/templates', async (t) => {
    const fastify = buildApp();

    // We override the db at the prototype or just replace the property if needed,
    // but fastify.decorate was already called. 
    // Wait, let's just create a custom buildApp for CRUD tests to avoid decorate collision:
    const fastifyCrud = Fastify();
    fastifyCrud.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (sql.includes('SELECT 1 FROM workspace_members')) {
                return { rowCount: 1, rows: [] };
            }
            if (sql.includes('SELECT id, workspace_id, name')) {
                return { rowCount: 1, rows: [{ id: 'tmpl-001', name: 'My Template' }] };
            }
            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { }
    } as any);
    fastifyCrud.register(mockAuthPlugin);
    fastifyCrud.register(workspaceGuardPlugin);
    fastifyCrud.register(templateRoutes);

    await fastifyCrud.ready();

    const res = await fastifyCrud.inject({
        method: 'GET',
        url: `/w/${WORKSPACE_ID}/templates?document_type=modul_ajar`,
        headers: { Authorization: `Bearer ${USER_ID}` },
    });

    t.equal(res.statusCode, 200);
    t.ok(Array.isArray(res.json().templates));
    t.equal(res.json().templates[0].name, 'My Template');

    await fastifyCrud.close();
});

test('POST /w/:workspaceId/templates', async (t) => {
    const fastifyCrud = Fastify();
    fastifyCrud.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            if (sql.includes('INSERT INTO document_templates')) {
                return { rowCount: 1, rows: [{ id: 'tpl_123' }] };
            }
            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { }
    } as any);
    fastifyCrud.register(mockAuthPlugin);
    fastifyCrud.register(workspaceGuardPlugin);
    fastifyCrud.register(templateRoutes);
    await fastifyCrud.ready();

    const res = await fastifyCrud.inject({
        method: 'POST',
        url: `/w/${WORKSPACE_ID}/templates`,
        headers: { Authorization: `Bearer ${USER_ID}` },
        payload: {
            name: 'New Template',
            document_type: 'modul_ajar',
            layout_definition: { sections: [] }
        }
    });

    t.equal(res.statusCode, 201);
    t.ok(res.json().id);

    await fastifyCrud.close();
});

test('PUT /w/:workspaceId/templates/:id', async (t) => {
    const fastifyCrud = Fastify();
    fastifyCrud.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            if (sql.includes('SELECT id FROM document_templates')) {
                return { rowCount: 1, rows: [{ id: 'tpl_123' }] };
            }
            if (sql.includes('UPDATE document_templates')) {
                return { rowCount: 1, rows: [{ id: 'tpl_123' }] };
            }
            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { }
    } as any);
    fastifyCrud.register(mockAuthPlugin);
    fastifyCrud.register(workspaceGuardPlugin);
    fastifyCrud.register(templateRoutes);
    await fastifyCrud.ready();

    const res = await fastifyCrud.inject({
        method: 'PUT',
        url: `/w/${WORKSPACE_ID}/templates/tpl_123`,
        headers: { Authorization: `Bearer ${USER_ID}` },
        payload: {
            name: 'Updated Template',
            description: 'Updated description',
            layout_definition: { sections: [{ id: 'A', enabled: true }] }
        }
    });

    t.equal(res.statusCode, 200);

    await fastifyCrud.close();
});

test('GET /w/:workspaceId/templates/default', async (t) => {
    const fastifyCrud = Fastify();
    fastifyCrud.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            if (sql.includes('SELECT document_type, template_id')) {
                return { rowCount: 1, rows: [{ document_type: 'modul_ajar', template_id: 'default_123' }] };
            }
            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { }
    } as any);
    fastifyCrud.register(mockAuthPlugin);
    fastifyCrud.register(workspaceGuardPlugin);
    fastifyCrud.register(templateRoutes);
    await fastifyCrud.ready();

    const res = await fastifyCrud.inject({
        method: 'GET',
        url: `/w/${WORKSPACE_ID}/templates/default?document_type=modul_ajar`,
        headers: { Authorization: `Bearer ${USER_ID}` },
    });

    t.equal(res.statusCode, 200);
    t.equal(res.json().defaults[0].template_id, 'default_123');
    await fastifyCrud.close();

    // test empty defaults
    const fastify404 = Fastify();
    fastify404.decorate('db', {
        query: async (sql: string) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { }
    } as any);
    fastify404.register(mockAuthPlugin);
    fastify404.register(workspaceGuardPlugin);
    fastify404.register(templateRoutes);
    await fastify404.ready();

    const res404 = await fastify404.inject({
        method: 'GET',
        url: `/w/${WORKSPACE_ID}/templates/default?document_type=modul_ajar`,
        headers: { Authorization: `Bearer ${USER_ID}` },
    });
    t.equal(res404.statusCode, 200);
    t.same(res404.json().defaults, []);
    await fastify404.close();
});

test('POST /w/:workspaceId/templates/default', async (t) => {
    const fastifyCrud = Fastify();
    fastifyCrud.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            if (sql.includes('SELECT id FROM document_templates')) {
                return { rowCount: 1, rows: [{ id: 'tpl_999' }] };
            }
            if (sql.includes('INSERT INTO workspace_default_templates')) {
                return { rowCount: 1, rows: [] };
            }
            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { }
    } as any);
    fastifyCrud.register(mockAuthPlugin);
    fastifyCrud.register(workspaceGuardPlugin);
    fastifyCrud.register(templateRoutes);
    await fastifyCrud.ready();

    const res = await fastifyCrud.inject({
        method: 'POST',
        url: `/w/${WORKSPACE_ID}/templates/default`,
        headers: { Authorization: `Bearer ${USER_ID}` },
        payload: {
            document_type: 'modul_ajar',
            template_id: 'tpl_999'
        }
    });

    t.equal(res.statusCode, 200);

    await fastifyCrud.close();
});

test('Templates Branch Coverage — Admin Checks & Error Cases', async (t) => {

    await t.test('POST /w/:workspaceId/templates — returns 403 for non-admin', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'member' }] };
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/templates`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { name: 'Test', document_type: 'atp', layout_definition: { sections: [] } }
        });
        t.equal(res.statusCode, 403);
        await fastify.close();
    });

    await t.test('PUT /w/:workspaceId/templates/:id — returns 404 for missing template', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
                if (sql.includes('SELECT id FROM document_templates')) return { rowCount: 0, rows: [] };
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PUT',
            url: `/w/${WORKSPACE_ID}/templates/tpl_missing`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { name: 'Update', layout_definition: { sections: [] } }
        });
        t.equal(res.statusCode, 404);
        await fastify.close();
    });

    await t.test('POST /w/:workspaceId/templates/default — returns 400 for invalid template_id', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'owner' }] };
                if (sql.includes('SELECT id FROM document_templates')) return { rowCount: 0, rows: [] };
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/templates/default`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { document_type: 'modul_ajar', template_id: 'bad_id' }
        });
        t.equal(res.statusCode, 400);
        await fastify.close();
    });

    await t.test('POST /w/:workspaceId/templates — returns 500 on db error', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
                throw new Error('Database disconnected');
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/templates`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { name: 'Test', document_type: 'atp', layout_definition: { sections: [] } }
        });
        t.equal(res.statusCode, 500);
        await fastify.close();
    });

    await t.test('PUT /w/:workspaceId/templates/:id — returns 403 for non-admin', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'member' }] };
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PUT',
            url: `/w/${WORKSPACE_ID}/templates/tpl_123`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { name: 'Update', layout_definition: { sections: [] } }
        });
        t.equal(res.statusCode, 403);
        await fastify.close();
    });

    await t.test('PUT /w/:workspaceId/templates/:id — returns 500 on db error', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
                if (sql.includes('SELECT id FROM document_templates')) return { rowCount: 1, rows: [{ id: 'tpl_123' }] };
                if (sql.includes('UPDATE document_templates')) throw new Error('Update failed');
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PUT',
            url: `/w/${WORKSPACE_ID}/templates/tpl_123`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { name: 'Update', layout_definition: { sections: [] } }
        });
        t.equal(res.statusCode, 500);
        await fastify.close();
    });

    await t.test('GET /templates/recommended — returns 500 on db error', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
                if (sql.includes('SELECT')) throw new Error('Query failed');
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/recommended?subject=matematika&grade=4`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            remoteAddress: '127.0.0.99' // Unique IP to avoid 429
        });
        t.equal(res.statusCode, 500);
        await fastify.close();
    });

    await t.test('GET /w/:workspaceId/templates — returns 500 on db error', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
                if (sql.includes('SELECT id, workspace_id')) throw new Error('Fetch failed');
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 500);
        await fastify.close();
    });

    await t.test('POST /w/:workspaceId/templates/default — returns 403 for non-admin', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'member' }] };
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/templates/default`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { document_type: 'atp', template_id: 'tpl_123' }
        });
        t.equal(res.statusCode, 403);
        await fastify.close();
    });

    await t.test('POST /w/:workspaceId/templates/default — returns 500 on db error', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
                if (sql.includes('SELECT id FROM document_templates')) return { rowCount: 1, rows: [{ id: 'tpl_123' }] };
                if (sql.includes('INSERT INTO workspace_default_templates')) throw new Error('Insert failed');
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/templates/default`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { document_type: 'atp', template_id: 'tpl_123' }
        });
        t.equal(res.statusCode, 500);
        await fastify.close();
    });

    await t.test('GET /w/:workspaceId/templates/default — returns 500 on db error', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
                if (sql.includes('SELECT document_type, template_id')) throw new Error('Fetch default failed');
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/templates/default`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 500);
        await fastify.close();
    });

    await t.test('Workspace Guard — returns 403 for non-member', async (t) => {
        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string) => {
                if (sql.includes('workspace_members')) return { rowCount: 0, rows: [] };
                return { rowCount: 0, rows: [] };
            }
        } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(templateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/NOT_MY_WORKSPACE/templates`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 403);
        t.match(res.json().message, /Not a member/);
        await fastify.close();
    });
});

