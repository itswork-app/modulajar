import { Storage } from '@google-cloud/storage';

const storage = new Storage();

export async function generateSignedUrl(
    bucketName: string,
    filePath: string,
    expiresInSeconds: number = 600
): Promise<string> {
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
