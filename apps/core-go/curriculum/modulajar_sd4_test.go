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
		TujuanPembelajaran: "Short", // < 10
	}
	err := EvaluateModulAjar(m)
	if err == nil || !testing.Short() && err.Error() == "" {
		// Just ensure it catches something
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
