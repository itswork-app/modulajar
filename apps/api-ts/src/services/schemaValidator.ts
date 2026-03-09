import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const domainsPath = path.join(process.cwd(), '../../packages/contracts/domain');

function loadSchema(filename: string) {
    try {
        const schemaPath = path.join(domainsPath, filename);
        if (fs.existsSync(schemaPath)) {
            const schemaContent = fs.readFileSync(schemaPath, 'utf8');
            return JSON.parse(schemaContent);
        }
        return null;
    } catch (err) {
        console.warn(`Could not load schema ${filename}`, err);
        return null;
    }
}

const documentModuleSchema = loadSchema('document_module.schema.json');
const artifactMetadataSchema = loadSchema('artifact_metadata.schema.json');

const validateDocumentModule = documentModuleSchema ? ajv.compile(documentModuleSchema) : null;
const validateArtifactMetadata = artifactMetadataSchema ? ajv.compile(artifactMetadataSchema) : null;

export function validateDocumentModuleJson(data: any): { valid: boolean; errors?: ErrorObject[] } {
    if (!validateDocumentModule) return { valid: true }; // Skip if schema not found
    const valid = validateDocumentModule(data);
    return { valid: valid as boolean, errors: validateDocumentModule.errors || undefined };
}

export function validateArtifactMetadataJson(data: any): { valid: boolean; errors?: ErrorObject[] } {
    if (!validateArtifactMetadata) return { valid: true }; // Skip if schema not found
    const valid = validateArtifactMetadata(data);
    return { valid: valid as boolean, errors: validateArtifactMetadata.errors || undefined };
}
