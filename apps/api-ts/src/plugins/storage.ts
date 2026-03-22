import fp from 'fastify-plugin';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();

export interface StoragePlugin {
    generateSignedUrl(bucketName: string, filePath: string, expiresInSeconds?: number): Promise<string>;
}

const storagePlugin = fp(async (fastify, options) => {
    fastify.decorate('storage', {
        generateSignedUrl: async (bucketName: string, filePath: string, expiresInSeconds: number = 600) => {
            if (!bucketName) {
                throw new Error('Bucket name is required');
            }

            const bucket = storage.bucket(bucketName);
            const file = bucket.file(filePath);

            const [url] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + expiresInSeconds * 1000,
            });

            return url;
        }
    });
});

export default storagePlugin;

declare module 'fastify' {
    export interface FastifyInstance {
        storage: StoragePlugin;
    }
}
