import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface RenderInput {
    subjectName: string;
    kelas: string;
    semester: string;
    tahunAjaran: string;
    teacherName: string;
    schoolName: string;
    title: string;
    pid: string;
    did: string;
    verifyUrl: string;
    moduleJson: any;
}

export function renderModuleHtml(input: RenderInput): string {
    const templateDir = path.join(__dirname, '../../../core-go/templates/v1');
    const templatePath = path.join(templateDir, 'modul-ajar.html');
    const cssPath = path.join(templateDir, 'styles.css');

    let html = fs.readFileSync(templatePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    const m = input.moduleJson;

    // Build Activity Sections
    let activityHtml = '<div class="activity-unit">';
    activityHtml += `<h3 class="activity-unit-title">Tujuan Pembelajaran</h3>`;
    activityHtml += `<div class="activity-content"><p>${m.tujuan_pembelajaran || ''}</p></div>`;
    activityHtml += `<h3 class="activity-unit-title">Materi Pembelajaran</h3>`;
    activityHtml += `<div class="activity-content"><p>${m.materi_pembelajaran || ''}</p></div>`;

    if (m.kegiatan_pembelajaran) {
        activityHtml += `<h3 class="activity-unit-title">Kegiatan Pembelajaran</h3>`;
        activityHtml += `<div class="activity-content">`;
        activityHtml += `<p><strong>Pendahuluan:</strong><br/>${m.kegiatan_pembelajaran.pendahuluan || ''}</p>`;
        activityHtml += `<p><strong>Inti:</strong><br/>${m.kegiatan_pembelajaran.inti || ''}</p>`;
        activityHtml += `<p><strong>Penutup:</strong><br/>${m.kegiatan_pembelajaran.penutup || ''}</p>`;
        activityHtml += `</div>`;
    }
    activityHtml += '</div>';

    // Build Assessment
    let assessmentHtml = '';
    if (m.penilaian) {
        assessmentHtml += `<div class="assessment-block"><h3 class="assessment-type">Sikap</h3><p>${m.penilaian.sikap || ''}</p></div>`;
        assessmentHtml += `<div class="assessment-block"><h3 class="assessment-type">Pengetahuan</h3><p>${m.penilaian.pengetahuan || ''}</p></div>`;
        assessmentHtml += `<div class="assessment-block"><h3 class="assessment-type">Keterampilan</h3><p>${m.penilaian.keterampilan || ''}</p></div>`;
    }

    const replacements: Record<string, string> = {
        '/* STYLES_PLACEHOLDER */': css,
        '{{TITLE}}': input.title || `Modul Ajar ${input.subjectName}`,
        '{{TEACHER_NAME}}': input.teacherName,
        '{{SCHOOL_NAME}}': input.schoolName,
        '{{KELAS}}': input.kelas,
        '{{SEMESTER}}': input.semester,
        '{{TAHUN_AJARAN}}': input.tahunAjaran,
        '{{SUBJECT_NAME}}': input.subjectName,
        '{{ALL_SECTIONS}}': activityHtml + assessmentHtml,
        '{{PID}}': input.pid,
        '{{DID}}': input.did,
        '{{VERIFY_URL}}': input.verifyUrl,
        '{{KOP_SURAT}}': '', // Placeholder for now
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
        html = html.split(placeholder).join(value);
    }

    return html;
}

export function computeHtmlSha256(html: string): string {
    return createHash('sha256').update(html).digest('hex');
}
