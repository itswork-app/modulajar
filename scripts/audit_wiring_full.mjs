import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const FRONTEND_DIR = path.join(ROOT, 'apps/console-web/app');
const BACKEND_DIR = path.join(ROOT, 'apps/api-ts/src/routes');

console.log('--- WIRING AUDIT: FRONTEND -> BACKEND ---');

// 1. Extract all API calls from Frontend
const frontendCalls = new Map(); // endpoint -> file
function scanFrontend(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanFrontend(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Improved regex for fetch URLs
            const matches = content.matchAll(/fetch\(\s*[`"'](\/api\/[^`"']+)[`"']/g);
            for (const match of matches) {
                let raw = match[1];
                let endpoint = raw.replace('/api', '');
                endpoint = endpoint.replace(/\$\{[^}]+\}/g, ':param');
                endpoint = endpoint.replace(/\[[^\]]+\]/g, ':param');
                // Handle cases like w/:wid/modules/${mid}
                endpoint = endpoint.replace(/:[a-zA-Z0-9]+/g, ':param');
                frontendCalls.set(endpoint, path.relative(ROOT, fullPath));
            }
        }
    }
}

// 2. Extract all Routes from Backend
const backendRoutes = new Set();
function scanBackend(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanBackend(fullPath);
        } else if (file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Match childServer.get<...>(...) or childServer.get(...)
            // Regex explanation: childServer.method, skip potential <...>, match ('...')
            const matches = content.matchAll(/childServer\.(get|post|put|delete|patch)(?:<[^>]+>)?\s*\(\s*['"]([^'"]+)['"]/g);
            for (const match of matches) {
                let route = match[2];
                // Handle /w prefix if the file uses it anywhere
                if (content.includes("prefix: '/w'") || content.includes('prefix: "/w"')) {
                    route = '/w' + route;
                }
                // Normalize: replace :workspaceId or :moduleId with :param
                route = route.replace(/:[a-zA-Z0-9]+/g, ':param');
                backendRoutes.add(route);
            }
        }
    }
}

scanFrontend(FRONTEND_DIR);
scanBackend(BACKEND_DIR);

console.log(`Found ${frontendCalls.size} unique frontend API calls.`);
console.log(`Found ${backendRoutes.size} unique backend routes.`);

let violations = 0;
const results = [];

for (const [call, file] of frontendCalls.entries()) {
    if (!backendRoutes.has(call)) {
        results.push({ call, file, status: 'MISSING' });
        violations++;
    } else {
        results.push({ call, file, status: 'OK' });
    }
}

console.table(results);

console.log('\n--- BACKEND ROUTES DETECTED ---');
console.log(Array.from(backendRoutes).sort());

if (violations > 0) {
    console.error(`\nFAIL: Found ${violations} potential wiring mismatches.`);
    // Note: Some might be false positives due to complex template strings
} else {
    console.log('\nPASSED: All detected frontend calls have matching backend routes.');
}
