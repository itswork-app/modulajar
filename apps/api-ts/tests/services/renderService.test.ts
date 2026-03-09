import tap from 'tap';
import { renderModuleHtml, computeHtmlSha256 } from '../../src/services/renderService';
import fs from 'fs';
import path from 'path';

// Mock fs to return dummy templates since we're not testing the file system
const originalReadFileSync = fs.readFileSync;

tap.test('Render Service', async (t) => {
    t.beforeEach(() => {
        (fs as any).readFileSync = (pathStr: string, enc: string) => {
            if (pathStr.includes('modul-ajar.html')) {
                return '<html>/* STYLES_PLACEHOLDER */<body>{{TITLE}} {{TEACHER_NAME}} {{SCHOOL_NAME}} {{ACTIVITY_SECTIONS}} {{ASSESSMENT_SECTION}}</body></html>';
            }
            if (pathStr.includes('styles.css')) {
                return 'body { color: black; }';
            }
            return originalReadFileSync(pathStr, enc);
        };
    });

    t.afterEach(() => {
        fs.readFileSync = originalReadFileSync;
    });

    t.test('renderModuleHtml', async (t) => {
        t.test('should render with all fields present', async (t) => {
            const input = {
                subjectName: 'IPA',
                kelas: '4',
                semester: '1',
                tahunAjaran: '2025/2026',
                teacherName: 'Guru Budi',
                schoolName: 'SDN 1',
                title: 'Modul IPA',
                pid: 'PID123',
                did: 'DID123',
                verifyUrl: 'http://test',
                moduleJson: {
                    tujuan_pembelajaran: 'Tujuan 1',
                    materi_pembelajaran: 'Materi 1',
                    kegiatan_pembelajaran: {
                        pendahuluan: 'Pendahuluan',
                        inti: 'Inti',
                        penutup: 'Penutup'
                    },
                    penilaian: {
                        sikap: 'Sikap',
                        pengetahuan: 'Pengetahuan',
                        keterampilan: 'Keterampilan'
                    }
                }
            };
            const html = renderModuleHtml(input as any);
            t.ok(html.includes('Tujuan 1'));
            t.ok(html.includes('Pendahuluan'));
            t.ok(html.includes('Sikap'));
        });

        t.test('should render correctly when optional fields are missing', async (t) => {
            const input = {
                subjectName: 'MTK',
                kelas: '4',
                semester: '1',
                tahunAjaran: '2025/2026',
                teacherName: 'Guru Budi',
                schoolName: 'SDN 1',
                title: '', // tests default title fallback
                pid: 'PID123',
                did: 'DID123',
                verifyUrl: 'http://test',
                moduleJson: {} // tests all missing fields
            };
            const html = renderModuleHtml(input as any);
            t.ok(html.includes('Modul Ajar MTK')); // fallback title
            t.notOk(html.includes('Pendahuluan'));
            t.notOk(html.includes('Sikap'));
        });

        t.test('should render correctly with partial optional fields', async (t) => {
            const input = {
                subjectName: 'MTK',
                kelas: '4',
                semester: '1',
                tahunAjaran: '2025/2026',
                teacherName: 'Guru Budi',
                schoolName: 'SDN 1',
                title: 'Partial',
                pid: 'PID123',
                did: 'DID123',
                verifyUrl: 'http://test',
                moduleJson: {
                    kegiatan_pembelajaran: {}, // empty object
                    penilaian: {} // empty object
                }
            };
            const html = renderModuleHtml(input as any);
            t.ok(html.includes('Partial'));
        });
    });

    t.test('computeHtmlSha256', async (t) => {
        const hash = computeHtmlSha256('test');
        t.equal(hash.length, 64);
        t.type(hash, 'string');
    });
});
