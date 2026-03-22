package qeval

import (
	"modulajar/apps/core-go/curriculum"
	"testing"
)

func contains(slice []string, val string) bool {
	for _, s := range slice {
		if s == val {
			return true
		}
	}
	return false
}

func TestEvaluateMerdeka(t *testing.T) {
	tests := []struct {
		name     string
		input    *curriculum.ModulAjarMerdeka
		wantFlag string
	}{
		{
			"Missing TP",
			&curriculum.ModulAjarMerdeka{TujuanPembelajaran: ""},
			FlagMissingLearningObjective,
		},
		{
			"Short Content",
			&curriculum.ModulAjarMerdeka{
				TujuanPembelajaran:   "TP",
				KegiatanPembelajaran: curriculum.KegiatanPembelajaranMerdeka{Inti: "Short"},
			},
			FlagShortContent,
		},
		{
			"Placeholder",
			&curriculum.ModulAjarMerdeka{
				TujuanPembelajaran: "TP",
				MateriPembelajaran: "Lorem Ipsum",
			},
			FlagPlaceholderText,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := EvaluateMerdeka(tt.input)
			if tt.wantFlag != "" && !contains(res.Flags, tt.wantFlag) {
				t.Errorf("expected flag %q, got %v", tt.wantFlag, res.Flags)
			}
		})
	}
}

func TestEvaluateMerdeka_Success(t *testing.T) {
	m := &curriculum.ModulAjarMerdeka{
		TujuanPembelajaran: "Tujuan pembelajaran yang sangat berkualitas dan mendalam",
		MateriPembelajaran: "Materi pembelajaran yang komprehensif untuk siswa",
		KegiatanPembelajaran: curriculum.KegiatanPembelajaranMerdeka{
			Inti: "Kegiatan inti yang terstruktur dengan sangat baik dan menarik serta edukatif bagi siswa",
		},
		Penilaian: curriculum.PenilaianMerdeka{
			Pengetahuan: "Penilaian pengetahuan yang objektif dan mencakup semua aspek pembelajaran",
		},
		ProfilPelajarPancasila: []string{"Mandiri"},
	}
	res := EvaluateMerdeka(m)
	if res.Score < 80 {
		t.Errorf("expected high score, got %d. Flags: %v", res.Score, res.Flags)
	}
}
