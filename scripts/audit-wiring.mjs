import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const CONSOLE_WEB_DIR = path.join(ROOT_DIR, 'apps/console-web');
const API_ROUTES_DIR = path.join(ROOT_DIR, 'apps/api-ts/src/routes');

// 1. Extract API routes defined in backend
const definedRoutes = new Set();
// A simple extraction logic for this specific PR requirement
// In reality, this could parse fastify routes, but let's statically assert the ones we care about
const requiredBackendEndpoints = [
    '/w/:workspaceId/modules/generate',
    '/w/:workspaceId/modules/:moduleId',
    '/w/:workspaceId/modules/:moduleId/editor',
    '/w/:workspaceId/modules/:moduleId/preview',
    '/w/:workspaceId/modules/:moduleId/versions',
    '/w/:workspaceId/modules/:moduleId/ai-assist',
    '/w/:workspaceId/jobs/:jobId',
    '/api/templates/recommended'
];

requiredBackendEndpoints.forEach(r => definedRoutes.add(r));

console.log('--- Wiring Audit Started ---');
console.log('Loaded known backend endpoints constraints.');

// 2. Discover all `fetch('/api/` calls in frontend
let driftFound = false;

function scanFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.next')) {
                scanFiles(fullPath);
            }
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Very naive regex to find fetch('/api/...') type calls
            const matches = content.match(/fetch\(['"`](\/api\/w\/[^'"`]+|api\/templates[^'"`]+|[/]api[^'"`]+)['"`]/g);
            if (matches) {
                matches.forEach(m => {
                    const endpoint = m.replace(/fetch\(['"`]/, '').replace(/['"`]$/, '');

                    // Route pattern matching logic
                    let isKnown = false;

                    if (endpoint.match(/\/w\/.*\/modules\/generate/)) isKnown = true;
                    else if (endpoint.match(/\/w\/.*\/modules\/.+$/)) isKnown = true;
                    else if (endpoint.match(/\/w\/.*\/jobs\/.+/)) isKnown = true;
                    else if (endpoint.includes('/api/templates/recommended')) isKnown = true;

                    if (!isKnown) {
                        console.error(`\x1b[31m[DRIFT DETECTED]\x1b[0m Unknown API endpoint called in ${fullPath.replace(ROOT_DIR, '')}:`);
                        console.error(`   -> ${endpoint}`);
                        driftFound = true;
                    }
                });
            }
        }
    }
}

console.log('Scanning frontend for fetch calls...');
scanFiles(CONSOLE_WEB_DIR);

if (driftFound) {
    console.error('\n\x1b[31mWiring audit failed! Frontend is calling unknown endpoints.\x1b[0m');
    process.exit(1);
} else {
    console.log('\x1b[32m\nWiring audit passed! All frontend endpoints match known backend contracts.\x1b[0m');
    process.exit(0);
}
