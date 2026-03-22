import tap from 'tap';
import { validateDocumentModuleJson, validateArtifactMetadataJson } from '../../src/services/schemaValidator';

tap.test('Schema Validator Service', async (t) => {
    t.test('validateDocumentModuleJson', async (t) => {
        t.test('should validate a correct document module json', async (t) => {
            const validJson = {
                meta: {
                    jenjang: "SD",
                    kelas: "4",
                    mapel: "IPA",
                    semester: "1",
                    tahun_ajaran: "2025/2026"
                },
                identitas: {
                    sekolah: "Test School",
                    guru: "Test Teacher",
                    alokasi_waktu: "2x35"
                },
                tujuan_pembelajaran: ["Tujuan 1"],
                materi_inti: ["Materi 1"],
                langkah_pembelajaran: {
                    pendahuluan: ["1"],
                    inti: ["2"],
                    penutup: ["3"]
                },
                asesmen: {
                    diagnostik: ["1"],
                    formatif: ["2"],
                    sumatif: ["3"]
                }
            };

            const result = validateDocumentModuleJson(validJson);
            t.equal(result.valid, true);
            t.notOk(result.errors);
        });

        t.test('should fail validation on missing required fields', async (t) => {
            const invalidJson = {
                meta: {
                    jenjang: "SD",
                    kelas: "4",
                    mapel: "IPA",
                    semester: "1",
                    tahun_ajaran: "2025/2026"
                }
            };

            const result = validateDocumentModuleJson(invalidJson);
            t.equal(result.valid, false);
            t.ok(result.errors);
            t.ok(result.errors!.length > 0);
        });
    });

    t.test('validateArtifactMetadataJson', async (t) => {
        t.test('should validate a correct artifact metadata json', async (t) => {
            const valid = {
                pdf_sha256: "hash123",
                html_sha256: "hash456",
                generated_at: "2025-01-01T10:00:00Z",
                pdf_path: "gcs://bucket/file.pdf"
            };

            const result = validateArtifactMetadataJson(valid);
            t.equal(result.valid, true);
        });

        t.test('should fail on invalid types', async (t) => {
            const invalid = {
                pdf_sha256: 12345 // should be string
            };

            const result = validateArtifactMetadataJson(invalid);
            t.equal(result.valid, false);
            t.ok(result.errors);
        });
    });
});
