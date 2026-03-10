export const JENJANG_OPTIONS = ['SD', 'SMP', 'SMA', 'SMK'] as const;
export type Jenjang = typeof JENJANG_OPTIONS[number];

export const KELAS_OPTIONS: Record<Jenjang, number[]> = {
    SD: [1, 2, 3, 4, 5, 6],
    SMP: [7, 8, 9],
    SMA: [10, 11, 12],
    SMK: [10, 11, 12]
};

export const MAPEL_OPTIONS: Record<Jenjang, string[]> = {
    SD: [
        'Matematika',
        'Bahasa Indonesia',
        'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
        'Pendidikan Pancasila',
        'Pendidikan Agama dan Budi Pekerti',
        'PJOK',
        'Seni dan Prakarya',
        'Bahasa Inggris',
        'Muatan Lokal'
    ],
    SMP: [
        'Matematika',
        'Ilmu Pengetahuan Alam (IPA)',
        'Ilmu Pengetahuan Sosial (IPS)',
        'Bahasa Indonesia',
        'Bahasa Inggris',
        'Pendidikan Pancasila',
        'Pendidikan Agama dan Budi Pekerti',
        'PJOK',
        'Informatika',
        'Seni Budaya',
        'Prakarya',
        'Muatan Lokal'
    ],
    SMA: [
        'Matematika',
        'Biologi',
        'Fisika',
        'Kimia',
        'Ekonomi',
        'Geografi',
        'Sosiologi',
        'Sejarah',
        'Bahasa Indonesia',
        'Bahasa Inggris',
        'Pendidikan Pancasila',
        'Pendidikan Agama dan Budi Pekerti',
        'PJOK',
        'Informatika',
        'Seni',
        'Prakarya dan Kewirausahaan',
        'Muatan Lokal'
    ],
    SMK: [
        'Matematika',
        'Bahasa Indonesia',
        'Bahasa Inggris',
        'Dasar-dasar Kejuruan',
        'Konsentrasi Kejuruan',
        'Projek Kreatif dan Kewirausahaan',
        'Pendidikan Pancasila',
        'Pendidikan Agama dan Budi Pekerti',
        'PJOK',
        'Informatika',
        'Sejarah',
        'Seni',
        'Muatan Lokal'
    ]
};
