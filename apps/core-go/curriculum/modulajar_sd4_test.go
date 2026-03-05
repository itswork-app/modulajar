package curriculum

import (
	"testing"
)

func TestValidateModulAjar(t *testing.T) {
	tests := []struct {
		name    string
		input   *ModulAjarSD4
		wantErr bool
	}{
		{
			"Valid",
			&ModulAjarSD4{
				TujuanPembelajaran:     "TP",
				MateriPembelajaran:     "MAT",
				KegiatanPembelajaran:   KegiatanPembelajaranSD4{Inti: "INTI"},
				Penilaian:              PenilaianSD4{Pengetahuan: "PEN"},
				ProfilPelajarPancasila: []string{"P3"},
				SaranaPrasarana:        []string{"SAPRA"},
			},
			false,
		},
		{
			"Missing TP",
			&ModulAjarSD4{
				MateriPembelajaran:     "MAT",
				KegiatanPembelajaran:   KegiatanPembelajaranSD4{Inti: "INTI"},
				Penilaian:              PenilaianSD4{Pengetahuan: "PEN"},
				ProfilPelajarPancasila: []string{"P3"},
				SaranaPrasarana:        []string{"SAPRA"},
			},
			true,
		},
		{
			"Missing Materi",
			&ModulAjarSD4{
				TujuanPembelajaran:     "TP",
				KegiatanPembelajaran:   KegiatanPembelajaranSD4{Inti: "INTI"},
				Penilaian:              PenilaianSD4{Pengetahuan: "PEN"},
				ProfilPelajarPancasila: []string{"P3"},
				SaranaPrasarana:        []string{"SAPRA"},
			},
			true,
		},
		{
			"Missing Inti",
			&ModulAjarSD4{
				TujuanPembelajaran:     "TP",
				MateriPembelajaran:     "MAT",
				Penilaian:              PenilaianSD4{Pengetahuan: "PEN"},
				ProfilPelajarPancasila: []string{"P3"},
				SaranaPrasarana:        []string{"SAPRA"},
			},
			true,
		},
		{
			"Missing Pengetahuan",
			&ModulAjarSD4{
				TujuanPembelajaran:     "TP",
				MateriPembelajaran:     "MAT",
				KegiatanPembelajaran:   KegiatanPembelajaranSD4{Inti: "INTI"},
				ProfilPelajarPancasila: []string{"P3"},
				SaranaPrasarana:        []string{"SAPRA"},
			},
			true,
		},
		{
			"Missing P3",
			&ModulAjarSD4{
				TujuanPembelajaran:     "TP",
				MateriPembelajaran:     "MAT",
				KegiatanPembelajaran:   KegiatanPembelajaranSD4{Inti: "INTI"},
				Penilaian:              PenilaianSD4{Pengetahuan: "PEN"},
				ProfilPelajarPancasila: []string{},
				SaranaPrasarana:        []string{"SAPRA"},
			},
			true,
		},
		{
			"Missing Sapra",
			&ModulAjarSD4{
				TujuanPembelajaran:     "TP",
				MateriPembelajaran:     "MAT",
				KegiatanPembelajaran:   KegiatanPembelajaranSD4{Inti: "INTI"},
				Penilaian:              PenilaianSD4{Pengetahuan: "PEN"},
				ProfilPelajarPancasila: []string{"P3"},
				SaranaPrasarana:        []string{},
			},
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateModulAjar(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateModulAjar() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEvaluateModulAjar_FieldLength(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran: "Short", // < 10 but > 0
	}
	err := EvaluateModulAjar(m)
	if err == nil {
		t.Error("Expected error for short field")
	}
}

func TestEvaluateModulAjar_PlaceholderWords(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran:   "Ini adalah contoh tujuan pembelajaran yang cukup panjang",
		MateriPembelajaran:   "Materi pembelajaran memadai yang cukup panjang juga",
		KompetensiAwal:       "Kompetensi awal siswa yang sudah dimiliki",
		KegiatanPembelajaran: KegiatanPembelajaranSD4{Inti: "Kegiatan inti lorem ipsum dolor sit amet"},
		Penilaian:            PenilaianSD4{Pengetahuan: "Penilaian yang memadai dan lengkap"},
		RefleksiGuru:         "Refleksi guru tentang pembelajaran hari ini",
	}
	err := EvaluateModulAjar(m)
	if err == nil {
		t.Error("Expected error for placeholder word 'lorem ipsum'")
	}
}

func TestEvaluateModulAjar_AISelfReference(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran:   "Tujuan pembelajaran yang cukup panjang memadai",
		MateriPembelajaran:   "Materi pembelajaran yang cukup panjang memadai",
		KompetensiAwal:       "Kompetensi awal yang cukup panjang memadai",
		KegiatanPembelajaran: KegiatanPembelajaranSD4{Inti: "Saya adalah AI yang membantu Anda"},
		Penilaian:            PenilaianSD4{Pengetahuan: "Penilaian pengetahuan yang memadai"},
		RefleksiGuru:         "Refleksi guru tentang pembelajaran hari ini",
	}
	err := EvaluateModulAjar(m)
	if err == nil {
		t.Error("Expected error for AI self-reference")
	}
}

func TestEvaluateModulAjar_MarkdownSyntax(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran:   "Tujuan pembelajaran yang cukup panjang memadai",
		MateriPembelajaran:   "Materi pembelajaran **bold syntax** yang memadai",
		KompetensiAwal:       "Kompetensi awal yang cukup panjang memadai",
		KegiatanPembelajaran: KegiatanPembelajaranSD4{Inti: "Kegiatan inti yang cukup panjang"},
		Penilaian:            PenilaianSD4{Pengetahuan: "Penilaian pengetahuan yang memadai"},
		RefleksiGuru:         "Refleksi guru tentang pembelajaran hari ini",
	}
	err := EvaluateModulAjar(m)
	if err == nil {
		t.Error("Expected error for markdown syntax")
	}
}

func TestEvaluateModulAjar_Success(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran:   "Tujuan pembelajaran yang cukup panjang memadai",
		MateriPembelajaran:   "Materi pembelajaran yang cukup panjang memadai",
		KompetensiAwal:       "Kompetensi awal yang cukup panjang memadai",
		KegiatanPembelajaran: KegiatanPembelajaranSD4{Inti: "Kegiatan inti yang cukup panjang memadai"},
		Penilaian:            PenilaianSD4{Pengetahuan: "Penilaian pengetahuan yang memadai"},
		RefleksiGuru:         "Refleksi guru tentang pembelajaran hari ini",
	}
	err := EvaluateModulAjar(m)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
}

func TestSanitizeModulAjar(t *testing.T) {
	m := &ModulAjarSD4{
		Identitas: IdentitasSD4{
			Sekolah: "  SD N 1  ",
		},
		ProfilPelajarPancasila: []string{"  Mandiri  ", ""},
	}
	SanitizeModulAjar(m)
	if m.Identitas.Sekolah != "SD N 1" {
		t.Errorf("Expected cleaned school name, got %q", m.Identitas.Sekolah)
	}
	if len(m.ProfilPelajarPancasila) != 2 || m.ProfilPelajarPancasila[1] != "" {
		t.Errorf("Expected cleaned P3 slice [Mandiri ''], got %v", m.ProfilPelajarPancasila)
	}
}
