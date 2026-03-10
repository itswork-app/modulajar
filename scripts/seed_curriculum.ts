import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const SEED_DATA = [
    // SMP KELAS 7 - MATEMATIKA
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Matematika', semester: 1, title: 'Bilangan Bulat dan Pecahan', order: 1 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Matematika', semester: 1, title: 'Aljabar', order: 2 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Matematika', semester: 1, title: 'Persamaan Linear Satu Variabel', order: 3 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Matematika', semester: 2, title: 'Perbandingan (Rasio)', order: 4 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Matematika', semester: 2, title: 'Bangun Datar', order: 5 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Matematika', semester: 2, title: 'Statistika Dasar', order: 6 },

    // SMP KELAS 7 - IPA
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 1, title: 'Hakikat Ilmu Sains dan Metode Ilmiah', order: 1 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 1, title: 'Zat dan Perubahannya', order: 2 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 1, title: 'Suhu, Kalor, dan Pemuaian', order: 3 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 2, title: 'Gerak dan Gaya', order: 4 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 2, title: 'Klasifikasi Makhluk Hidup', order: 5 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 2, title: 'Ekosistem dan Interaksi Lingkungan', order: 6 },
    { jenjang: 'SMP', fase: 'D', kelas: 7, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 2, title: 'Bumi dan Tata Surya', order: 7 },

    // SMP KELAS 8 - MATEMATIKA
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Matematika', semester: 1, title: 'Pola Bilangan', order: 1 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Matematika', semester: 1, title: 'Sistem Koordinat Kartesius', order: 2 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Matematika', semester: 1, title: 'Relasi dan Fungsi', order: 3 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Matematika', semester: 1, title: 'Persamaan Garis Lurus', order: 4 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Matematika', semester: 2, title: 'Teorema Pythagoras', order: 5 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Matematika', semester: 2, title: 'Lingkaran', order: 6 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Matematika', semester: 2, title: 'Bangun Ruang Sisi Datar', order: 7 },

    // SMP KELAS 8 - IPA
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 1, title: 'Pengenalan Sel', order: 1 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 1, title: 'Sistem Pencernaan Manusia', order: 2 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 1, title: 'Sistem Peredaran Darah', order: 3 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 2, title: 'Getaran, Gelombang, dan Bunyi', order: 4 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 2, title: 'Cahaya dan Alat Optik', order: 5 },
    { jenjang: 'SMP', fase: 'D', kelas: 8, mapel: 'Ilmu Pengetahuan Alam (IPA)', semester: 2, title: 'Sistem Ekskresi Manusia', order: 6 }
];

async function run() {
    console.log('Seeding Curriculum Topics...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const topic of SEED_DATA) {
            const id = `KM-T-${topic.jenjang}-${topic.kelas}-${topic.mapel.replace(/ /g, '').substring(0, 5)}-${topic.semester}-${topic.order}`.toUpperCase();

            await client.query(`
                INSERT INTO curriculum_topics (id, jenjang, fase, kelas, mata_pelajaran, semester, title, display_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    jenjang = EXCLUDED.jenjang,
                    fase = EXCLUDED.fase,
                    kelas = EXCLUDED.kelas,
                    mata_pelajaran = EXCLUDED.mata_pelajaran,
                    semester = EXCLUDED.semester,
                    display_order = EXCLUDED.display_order
            `, [id, topic.jenjang, topic.fase, topic.kelas, topic.mapel, topic.semester, topic.title, topic.order]);
        }

        await client.query('COMMIT');
        console.log(`Successfully seeded ${SEED_DATA.length} curriculum topics.`);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Seed transaction failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
