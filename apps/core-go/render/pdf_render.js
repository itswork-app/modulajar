#!/usr/bin/env node
/**
 * pdf_render.js — Playwright-based PDF renderer for Modul Ajar
 * 
 * Usage:
 *   node pdf_render.js --html <path-to-html> --out <output-pdf-path>
 *   node pdf_render.js --html-stdin --out <output-pdf-path>  (reads HTML from stdin)
 * 
 * Requires: playwright or playwright-chromium installed
 * Environment: PLAYWRIGHT_BROWSERS_PATH (optional)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function renderPDF(htmlPath, outputPath) {
    let htmlContent;

    if (htmlPath === '--stdin') {
        // Read from stdin
        htmlContent = '';
        for await (const chunk of process.stdin) {
            htmlContent += chunk;
        }
    } else {
        if (!fs.existsSync(htmlPath)) {
            console.error(`ERROR: HTML file not found: ${htmlPath}`);
            process.exit(1);
        }
        htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    }

    if (!htmlContent || htmlContent.trim().length === 0) {
        console.error('ERROR: HTML content is empty');
        process.exit(1);
    }

    // Ensure output directory exists
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();

        // Set HTML content
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        // Generate PDF (A4 format matching template CSS)
        await page.pdf({
            path: outputPath,
            format: 'A4',
            margin: {
                top: '20mm',
                right: '18mm',
                bottom: '25mm',
                left: '18mm',
            },
            printBackground: true,
            preferCSSPageSize: true,
        });

        const stats = fs.statSync(outputPath);
        console.log(JSON.stringify({
            status: 'ok',
            output: outputPath,
            size_bytes: stats.size,
        }));
    } finally {
        await browser.close();
    }
}

// CLI argument parsing
const args = process.argv.slice(2);
let htmlPath = null;
let outputPath = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--html' && i + 1 < args.length) {
        htmlPath = args[i + 1];
        i++;
    } else if (args[i] === '--html-stdin') {
        htmlPath = '--stdin';
    } else if (args[i] === '--out' && i + 1 < args.length) {
        outputPath = args[i + 1];
        i++;
    }
}

if (!htmlPath || !outputPath) {
    console.error('Usage: node pdf_render.js --html <path> --out <output.pdf>');
    console.error('       node pdf_render.js --html-stdin --out <output.pdf>');
    process.exit(1);
}

renderPDF(htmlPath, outputPath).catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
});
