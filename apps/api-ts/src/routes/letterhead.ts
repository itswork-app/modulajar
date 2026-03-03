import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const GCS_BUCKET = process.env.GCS_BUCKET || 'modulajar-private-assets';

export default async function letterheadRoutes(fastify: FastifyInstance) {
    fastify.register(async (childServer) => {

        // GET /w/:workspaceId/letterhead
        childServer.get<{ Params: { workspaceId: string } }>('/:workspaceId/letterhead', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params;

            const { rowCount, rows } = await fastify.db.query(
                `SELECT letterhead_line1, letterhead_line2, letterhead_line3, letterhead_line4, letterhead_contact, logo_file_path, logo_sha256
                 FROM workspace_settings
                 WHERE workspace_id = $1`,
                [workspaceId]
            );

            if (rowCount === 0) {
                return reply.code(404).send({ error: 'Letterhead settings not found for this workspace' });
            }

            const data = rows[0];
            let logo_preview_url = null;

            if (data.logo_file_path) {
                try {
                    logo_preview_url = await fastify.storage.generateSignedUrl(GCS_BUCKET, data.logo_file_path, 3600);
                } catch (e) {
                    request.log.warn({ err: e }, "Failed to generate signed url for letterhead logo");
                }
            }

            return {
                letterhead_line1: data.letterhead_line1,
                letterhead_line2: data.letterhead_line2,
                letterhead_line3: data.letterhead_line3,
                letterhead_line4: data.letterhead_line4,
                letterhead_contact: data.letterhead_contact,
                logo_preview_url,
                logo_sha256: data.logo_sha256
            };
        });

        // POST /w/:workspaceId/letterhead (Multipart)
        childServer.post<{ Params: { workspaceId: string } }>('/:workspaceId/letterhead', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params;

            const parts = request.parts();
            let line1 = null, line2 = null, line3 = null, line4 = null, contact = null;
            let logoFilePath = null;
            let logoSha256 = null;

            for await (const part of parts) {
                if (part.type === 'file') {
                    if (part.fieldname === 'logo') {
                        // Validate file type
                        if (!['image/png', 'image/jpeg'].includes(part.mimetype)) {
                            return reply.code(400).send({ error: 'Logo must be a PNG or JPG image' });
                        }

                        // Read buffer to memory (small limit expected)
                        const buffer = await part.toBuffer();
                        if (buffer.length > 512 * 1024) {
                            return reply.code(400).send({ error: 'Logo size must not exceed 512KB' });
                        }

                        // Compute SHA-256
                        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
                        logoSha256 = hash;

                        // Upload to GCS
                        const gcsPath = `workspaces/${workspaceId}/logo_${Date.now()}_${part.filename}`;
                        const file = storage.bucket(GCS_BUCKET).file(gcsPath);
                        await file.save(buffer, {
                            contentType: part.mimetype,
                            resumable: false
                        });
                        logoFilePath = gcsPath;
                    } else {
                        // ignore other files but must drain them to avoid hanging
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        for await (const _ of part.file) { }
                    }
                } else {
                    // It's a field
                    const val = (part.value as string).trim();
                    const cleanVal = val.replace(/<[^>]*>?/gm, ''); // simple sanitize strip HTML

                    if (cleanVal.length > 120) {
                        return reply.code(400).send({ error: \`\${part.fieldname} must not exceed 120 characters\` });
                    }

                    switch(part.fieldname) {
                        case 'letterhead_line1': line1 = cleanVal || null; break;
                        case 'letterhead_line2': line2 = cleanVal || null; break;
                        case 'letterhead_line3': line3 = cleanVal || null; break;
                        case 'letterhead_line4': line4 = cleanVal || null; break;
                        case 'letterhead_contact': contact = cleanVal || null; break;
                    }
                }
            }

            // Update database preserving existing logo if not overridden
            let queryOptions = '';
            const values = [workspaceId, line1, line2, line3, line4, contact];

            if (logoFilePath) {
                values.push(logoFilePath, logoSha256);
                queryOptions = `, logo_file_path = EXCLUDED.logo_file_path, logo_sha256 = EXCLUDED.logo_sha256`;
            }

            const query = \`
                INSERT INTO workspace_settings (
                    workspace_id, 
                    school_display_name,
                    letterhead_line1,
                    letterhead_line2,
                    letterhead_line3,
                    letterhead_line4,
                    letterhead_contact
                    \${logoFilePath ? ', logo_file_path, logo_sha256' : ''}
                ) VALUES ($1, 'Workspace Config', $2, $3, $4, $5, $6 \${logoFilePath ? ', $7, $8' : ''})
                ON CONFLICT (workspace_id) 
                DO UPDATE SET 
                    letterhead_line1 = EXCLUDED.letterhead_line1,
                    letterhead_line2 = EXCLUDED.letterhead_line2,
                    letterhead_line3 = EXCLUDED.letterhead_line3,
                    letterhead_line4 = EXCLUDED.letterhead_line4,
                    letterhead_contact = EXCLUDED.letterhead_contact
                    \${queryOptions}
                RETURNING letterhead_line1, letterhead_line2, letterhead_line3, letterhead_line4, letterhead_contact, logo_file_path, logo_sha256
            \`;

            const { rows } = await fastify.db.query(query, values);
            const updated = rows[0];

            let logo_preview_url = null;
            if (updated.logo_file_path) {
                try {
                    logo_preview_url = await fastify.storage.generateSignedUrl(GCS_BUCKET, updated.logo_file_path, 3600);
                } catch(e) {}
            }

            request.log.info({ workspaceId, action: 'upsert_letterhead' }, "Letterhead updated");

            return {
                letterhead_line1: updated.letterhead_line1,
                letterhead_line2: updated.letterhead_line2,
                letterhead_line3: updated.letterhead_line3,
                letterhead_line4: updated.letterhead_line4,
                letterhead_contact: updated.letterhead_contact,
                logo_preview_url,
                logo_sha256: updated.logo_sha256
            };
        });

        // Optional route to clear logo
        childServer.post<{ Params: { workspaceId: string } }>('/:workspaceId/letterhead/clear-logo', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params;

            const query = \`
                UPDATE workspace_settings 
                SET logo_file_path = NULL, logo_sha256 = NULL
                WHERE workspace_id = $1
                RETURNING letterhead_line1
            \`;

            const { rowCount } = await fastify.db.query(query, [workspaceId]);
            if (rowCount === 0) {
                return reply.code(404).send({ error: 'Settings not found' });
            }

            return { success: true };
        });

    }, { prefix: '/w' });
}
