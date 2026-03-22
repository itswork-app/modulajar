import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const domainsPath = path.join(process.cwd(), '../../packages/contracts/domain');

function loadSchema(filename: string) {
    const schemaPath = path.join(domainsPath, filename);
    if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        return JSON.parse(schemaContent);
    }
    // PR-A6: Mandatory Enforcement
    const err = new Error(`Mandatory schema file missing: ${filename} at ${schemaPath}`);
    console.error(`CRITICAL: ${err.message}`);
    throw err;
}

const documentModuleSchema = loadSchema('document_module.schema.json');
const artifactMetadataSchema = loadSchema('artifact_metadata.schema.json');

const validateDocumentModule = ajv.compile(documentModuleSchema);
const validateArtifactMetadata = ajv.compile(artifactMetadataSchema);

export function validateDocumentModuleJson(data: any): { valid: boolean; errors?: ErrorObject[] } {
    const valid = validateDocumentModule(data);
    return { valid: valid as boolean, errors: validateDocumentModule.errors || undefined };
}

export function validateArtifactMetadataJson(data: any): { valid: boolean; errors?: ErrorObject[] } {
    const valid = validateArtifactMetadata(data);
    return { valid: valid as boolean, errors: validateArtifactMetadata.errors || undefined };
}
