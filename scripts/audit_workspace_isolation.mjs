import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SEARCH_PATHS = [
    path.join(ROOT_DIR, 'apps/api-ts/src'),
    path.join(ROOT_DIR, 'apps/worker-go/src'),
    path.join(ROOT_DIR, 'apps/core-go'),
];

const IGNORE_FILES = [
    'db.ts',
    'schema.sql',
    'migrations'
];

// Patterns that indicate a query might need workspace_id but doesn't have it
// We look for SELECT/UPDATE/DELETE on tables that are likely multi-tenant
const TENANT_TABLES = [
    'modules',
    'jobs',
    'templates',
    'onboarding',
    'documents',
    'packages',
    'generation_jobs',
    'teachers'
];

let violations = 0;

function auditFile(filePath) {
    if (IGNORE_FILES.some(ignore => filePath.includes(ignore))) return;
    if (filePath.endsWith('.test.ts') || filePath.endsWith('_test.go')) return;

    const content = fs.readFileSync(filePath, 'utf8');

    // Look for SQL strings
    const sqlRegex = /[`"'](?:SELECT|UPDATE|DELETE|INSERT).+?FROM\s+(\w+)|[`"'](?:UPDATE|DELETE)\s+(\w+)/gi;
    let match;

    while ((match = sqlRegex.exec(content)) !== null) {
        const table = (match[1] || match[2] || '').toLowerCase();
        if (TENANT_TABLES.includes(table)) {
            const queryBlock = content.substring(match.index, match.index + 200).toLowerCase();
            // Better check: workspace_id should follow WHERE or AND or JOIN, 
            // or be followed by = or IN.
            // Simple heuristic: must NOT be just "RETURNING workspace_id" or "INSERT (... workspace_id)"
            const isFiltered = queryBlock.includes('workspace_id') &&
                (queryBlock.includes('where') || queryBlock.includes('and') || queryBlock.includes('join'));

            if (!isFiltered) {
                // Potential violation
                console.error(`[VIOLATION] ${filePath}:${getLineNumber(content, match.index)}`);
                console.error(`Table: ${table}`);
                console.error(`Query snippet: ${match[0]}...`);
                console.error(`--------------------------------------------------`);
                violations++;
            }
        }
    }
}

function getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
}

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.go')) {
            auditFile(fullPath);
        }
    }
}

console.log('Running Workspace Isolation Audit...');
SEARCH_PATHS.forEach(walk);

if (violations > 0) {
    console.error(`\nFAILED: Found ${violations} potential workspace isolation violations.`);
    process.exit(1);
} else {
    console.log('\nPASSED: Workspace isolation audit completed successfully.');
}
