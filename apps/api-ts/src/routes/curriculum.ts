import { FastifyInstance } from 'fastify';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default async function curriculumRoutes(fastify: FastifyInstance) {
    fastify.register(async (childServer) => {

        // GET /w/:workspaceId/curriculum/topics
        childServer.get<{
            Params: { workspaceId: string };
            Querystring: { jenjang: string; kelas: string; mapel: string; semester?: string };
        }>('/:workspaceId/curriculum/topics', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                querystring: {
                    type: 'object',
                    required: ['jenjang', 'kelas', 'mapel'],
                    properties: {
                        jenjang: { type: 'string' },
                        kelas: { type: 'string' },
                        mapel: { type: 'string' },
                        semester: { type: 'string' }
                    }
                }
            }
        }, async (request, reply) => {
            const { jenjang, kelas, mapel, semester } = request.query;
            const kelasNum = parseInt(kelas, 10);

            let query = `
                SELECT id, title, semester, display_order, cp_reference, notes
                FROM curriculum_topics
                WHERE jenjang = $1 AND kelas = $2 AND mata_pelajaran = $3
            `;
            const params: any[] = [jenjang, kelasNum, mapel];

            if (semester) {
                query += ` AND semester = $4`;
                params.push(parseInt(semester, 10));
            }

            query += ` ORDER BY semester ASC NULLS FIRST, display_order ASC`;

            const { rows } = await fastify.db.query(query, params);

            return { topics: rows };
        });

        // POST /w/:workspaceId/curriculum/planner
        childServer.post<{
            Params: { workspaceId: string };
            Body: {
                jenjang: string;
                kelas: string;
                mapel: string;
                semester: string;
                fokus_materi?: string;
            };
        }>('/:workspaceId/curriculum/planner', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                body: {
                    type: 'object',
                    required: ['jenjang', 'kelas', 'mapel', 'semester'],
                    properties: {
                        jenjang: { type: 'string' },
                        kelas: { type: 'string' },
                        mapel: { type: 'string' },
                        semester: { type: 'string' },
                        fokus_materi: { type: 'string' }
                    }
                }
            }
        }, async (request, reply) => {
            const { jenjang, kelas, mapel, semester, fokus_materi } = request.body;
            const kelasNum = parseInt(kelas, 10);
            const semNum = parseInt(semester, 10);

            // 1. Fetch allowed curriculum topics
            const query = `
                SELECT id, title
                FROM curriculum_topics
                WHERE jenjang = $1 AND kelas = $2 AND mata_pelajaran = $3 AND semester = $4
                ORDER BY display_order ASC
            `;
            const { rows: topics } = await fastify.db.query(query, [jenjang, kelasNum, mapel, semNum]);

            if (topics.length === 0) {
                return reply.code(404).send({ error: 'No topics found for this curriculum context.' });
            }

            const topicListStr = topics.map((t, idx) => `[ID: ${t.id}] ${t.title}`).join('\n');

            // 2. Prompt OpenAI for ordering
            const systemPrompt = `You are an expert Indonesian teacher assisting with Kurikulum Merdeka semester planning. 
Your task is to select and order the most appropriate teaching topics for a single semester from the provided dataset.

Rules:
1. ONLY USE topics from the provided Catalog dataset. DO NOT invent new topics.
2. Return a valid JSON array of strings containing ONLY the "id" of the topics in the EXACT order they should be taught.
3. Consider the subject, grade, and any teacher-provided context when ordering.
4. Output format MUST be purely JSON.

Example output:
["topic_id_1", "topic_id_3", "topic_id_2"]
`;

            const userPrompt = `
Context:
Jenjang: ${jenjang}
Kelas / Fase: ${kelas}
Mata Pelajaran: ${mapel}
Semester: ${semester}
${fokus_materi ? `Fokus Guru / Konteks Lokal: ${fokus_materi}` : ''}

Available Catalog (ID and Title):
${topicListStr}

Propose the optimal ordered plan for this semester by returning a JSON array of their IDs.
`;

            try {
                const aiResponse = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.3,
                });

                const content = aiResponse.choices[0]?.message?.content || '{"plan":[]}';

                // We expect the model to return an array, but if we forced json_object, it might wrap it. 
                // Let's parse it safely.
                let parsedIds: string[] = [];
                try {
                    const parsed = JSON.parse(content);
                    // It could be directly an array if we didn't force json_object, but with json_object it's an object.
                    // Usually it returns {"list": ["id1"]} or {"plan": ["id1"]}
                    parsedIds = Array.isArray(parsed) ? parsed : Object.values(parsed).find(v => Array.isArray(v)) as string[] || [];

                    // Fallback to extraction if empty
                    if (parsedIds.length === 0) {
                        const match = content.match(/\[(.*?)\]/s);
                        if (match) {
                            parsedIds = JSON.parse(`[${match[1]}]`);
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse AI topic response', content);
                }

                // 3. Fallback and Validation
                // Only keep IDs that actually exist in the DB to prevent AI hallucination
                const validIds = parsedIds.filter(id => topics.some(t => t.id === id));

                let orderedTopics = validIds.map(id => topics.find(t => t.id === id)!);

                // Fallback to default catalog order if AI failed entirely or returned nothing valid
                if (orderedTopics.length === 0) {
                    orderedTopics = topics;
                }

                return { plan: orderedTopics };

            } catch (err) {
                request.log.error({ err }, 'AI Planner failed');

                // Fallback: return default order instead of failing the request
                return { plan: topics };
            }
        });

        // GET /w/:workspaceId/curriculum/dataset
        // Fetch high-quality curated modules from the curriculum dataset
        childServer.get<{
            Params: { workspaceId: string };
            Querystring: { subject?: string; grade?: string; limit?: string };
        }>('/:workspaceId/curriculum/dataset', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        subject: { type: 'string' },
                        grade: { type: 'string' },
                        limit: { type: 'string' }
                    }
                }
            }
        }, async (request, reply) => {
            const { subject, grade, limit } = request.query;
            const limitNum = parseInt(limit || '20', 10);

            let query = `
                SELECT id, subject, grade, topic, quality_score, usage_count, created_at
                FROM curriculum_dataset
            `;
            const params: any[] = [];
            const conditions: string[] = [];

            if (subject) {
                params.push(`%${subject}%`);
                conditions.push(`subject ILIKE $${params.length}`);
            }
            if (grade) {
                params.push(parseInt(grade, 10));
                conditions.push(`grade = $${params.length}`);
            }

            if (conditions.length > 0) {
                query += ` WHERE ` + conditions.join(' AND ');
            }

            query += ` ORDER BY quality_score DESC, created_at DESC LIMIT $${params.length + 1}`;
            params.push(limitNum);

            const { rows } = await fastify.db.query(query, params);

            return { dataset: rows };
        });

    }, { prefix: '/w' });
}
