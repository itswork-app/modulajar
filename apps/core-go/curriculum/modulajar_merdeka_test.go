package curriculum

import (
	"testing"
)

func TestValidateModulAjar(t *testing.T) {
	tests := []struct {
		name    string
		input   *ModulAjarMerdeka
		wantErr bool
	}{
		{
			"Valid",
			&ModulAjarMerdeka{
				TujuanPembelajaran:     "Tujuan pembelajaran yang cukup panjang",
				MateriPembelajaran:     "Materi pembelajaran yang memadai",
				KegiatanPembelajaran:   KegiatanPembelajaranMerdeka{Inti: "Kegiatan inti yang cukup panjang dan mendalam"},
				Penilaian:              PenilaianMerdeka{Pengetahuan: "Penilaian pengetahuan yang lengkap"},
				ProfilPelajarPancasila: []string{"Mandiri"},
				SaranaPrasarana:        []string{"Laptop"},
				PertanyaanPemantik:     []string{"Apa itu?"},
			},
			false,
		},
		{
			"Missing TP",
			&ModulAjarMerdeka{
				MateriPembelajaran:     "MAT",
				KegiatanPembelajaran:   KegiatanPembelajaranMerdeka{Inti: "INTI"},
				Penilaian:              PenilaianMerdeka{Pengetahuan: "PEN"},
				ProfilPelajarPancasila: []string{"P3"},
				SaranaPrasarana:        []string{"SAPRA"},
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

func TestEvaluateModulAjar(t *testing.T) {
	t.Run("Short Field", func(t *testing.T) {
		m := &ModulAjarMerdeka{
			TujuanPembelajaran: "Short",
		}
		err := EvaluateModulAjar(m)
		if err == nil {
			t.Error("Expected error for short field")
		}
	})

	t.Run("Placeholder Words", func(t *testing.T) {
		m := &ModulAjarMerdeka{
			TujuanPembelajaran:   "Ini adalah contoh tujuan pembelajaran yang cukup panjang",
			MateriPembelajaran:   "Materi pembelajaran memadai yang cukup panjang juga",
			KompetensiAwal:       "Kompetensi awal siswa yang sudah dimiliki",
			KegiatanPembelajaran: KegiatanPembelajaranMerdeka{Inti: "Kegiatan inti lorem ipsum dolor sit amet"},
			Penilaian:            PenilaianMerdeka{Pengetahuan: "Penilaian yang memadai dan lengkap"},
		}
		err := EvaluateModulAjar(m)
		if err == nil {
			t.Error("Expected error for placeholder word 'lorem ipsum'")
		}
	})

	t.Run("Success", func(t *testing.T) {
		m := &ModulAjarMerdeka{
			Identitas: IdentitasMerdeka{
				NamaGuru: "Guru Elite",
			},
			TujuanPembelajaran:   "Tujuan pembelajaran yang sangat berkualitas dan mendalam",
			MateriPembelajaran:   "Materi pembelajaran yang komprehensif untuk siswa",
			KompetensiAwal:       "Kompetensi awal yang relevan dengan topik ini",
			KegiatanPembelajaran: KegiatanPembelajaranMerdeka{Inti: "Kegiatan inti yang terstruktur dengan sangat baik dan menarik"},
			Penilaian:            PenilaianMerdeka{Pengetahuan: "Penilaian pengetahuan yang objektif dan mencakup semua aspek"},
			RefleksiGuru:         "Refleksi guru yang jujur dan membangun",
		}
		err := EvaluateModulAjar(m)
		if err != nil {
			t.Errorf("Expected no error, got: %v", err)
		}
	})
}

func TestSanitizeModulAjar(t *testing.T) {
	m := &ModulAjarMerdeka{
		Identitas: IdentitasMerdeka{
			NamaGuru: "  Budi  ",
			Sekolah:  "  SD N 1  ",
		},
		ProfilPelajarPancasila: []string{"  Mandiri  ", ""},
	}
	SanitizeModulAjar(m)
	if m.Identitas.NamaGuru != "Budi" {
		t.Errorf("Expected cleaned teacher name, got %q", m.Identitas.NamaGuru)
	}
	if m.Identitas.Sekolah != "SD N 1" {
		t.Errorf("Expected cleaned school name, got %q", m.Identitas.Sekolah)
	}
}
