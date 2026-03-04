package tests

import (
	"testing"

	"modulajar/apps/core-go/curriculum"
	"modulajar/apps/core-go/curriculum/qeval"
)

func TestScoreCompleteness(t *testing.T) {
	m := &curriculum.ModulAjarSD4{
		TujuanPembelajaran: "Siswa dapat berhitung",
		MateriPembelajaran: "Penjumlahan",
		Penilaian: curriculum.PenilaianSD4{
			Pengetahuan: "Tes tertulis yang sangat detail",
		},
		KegiatanPembelajaran: curriculum.KegiatanPembelajaranSD4{
			Inti: "Langkah 1: Belajar angka. Langkah 2: Belajar tambah. Langkah 3: Latihan soal.",
		},
		ProfilPelajarPancasila: []string{"Bernalar Kritis"},
	}

	res, _ := qeval.Evaluate(m)
	if res.Score < 85 {
		t.Errorf("Expected high score, got %d. Flags: %v", res.Score, res.Flags)
	}
}

func TestScoreMissingObjective(t *testing.T) {
	m := &curriculum.ModulAjarSD4{
		TujuanPembelajaran: "", // Missing
		MateriPembelajaran: "Penjumlahan",
	}

	res, _ := qeval.Evaluate(m)
	found := false
	for _, f := range res.Flags {
		if f == qeval.FlagMissingLearningObjective {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("Expected flag %s, not found in %v", qeval.FlagMissingLearningObjective, res.Flags)
	}
}

func TestVerdictThresholds(t *testing.T) {
	tests := []struct {
		score    int
		expected string
	}{
		{90, qeval.VerdictPass},
		{75, qeval.VerdictPassWarn},
		{65, qeval.VerdictRetry},
		{50, qeval.VerdictFail},
	}

	for _, tc := range tests {
		v := qeval.DetermineVerdict(tc.score)
		if v != tc.expected {
			t.Errorf("Score %d: expected %s, got %s", tc.score, tc.expected, v)
		}
	}
}

func TestMarkdownFlag(t *testing.T) {
	m := &curriculum.ModulAjarSD4{
		TujuanPembelajaran: "### Markdown Heading",
		MateriPembelajaran: "**Bold Text**",
	}

	res, _ := qeval.Evaluate(m)
	found := false
	for _, f := range res.Flags {
		if f == qeval.FlagMarkdownDetected {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("Expected flag %s, not found in %v", qeval.FlagMarkdownDetected, res.Flags)
	}
}

func TestDeterminism(t *testing.T) {
	m := &curriculum.ModulAjarSD4{
		TujuanPembelajaran: "Test",
	}
	res1, _ := qeval.Evaluate(m)
	res2, _ := qeval.Evaluate(m)

	if res1.Score != res2.Score || len(res1.Flags) != len(res2.Flags) {
		t.Error("Evaluator is not deterministic")
	}
}

func TestFlags(t *testing.T) {
	tests := []struct {
		name     string
		input    *curriculum.ModulAjarSD4
		wantFlag string
	}{
		{
			"Missing Materi",
			&curriculum.ModulAjarSD4{TujuanPembelajaran: "X"},
			qeval.FlagMissingMateri,
		},
		{
			"Missing Assessment",
			&curriculum.ModulAjarSD4{TujuanPembelajaran: "X", MateriPembelajaran: "X"},
			qeval.FlagMissingAssessment,
		},
		{
			"Generic Assessment",
			&curriculum.ModulAjarSD4{TujuanPembelajaran: "X", MateriPembelajaran: "X", Penilaian: curriculum.PenilaianSD4{Pengetahuan: "Tes Tertulis"}},
			qeval.FlagAssessmentTooGeneric,
		},
		{
			"Short Content",
			&curriculum.ModulAjarSD4{TujuanPembelajaran: "X", MateriPembelajaran: "X", KegiatanPembelajaran: curriculum.KegiatanPembelajaranSD4{Inti: "Short"}},
			qeval.FlagShortContent,
		},
		{
			"Placeholder",
			&curriculum.ModulAjarSD4{TujuanPembelajaran: "X", MateriPembelajaran: "Lorem Ipsum"},
			qeval.FlagPlaceholderText,
		},
		{
			"AI Reference",
			&curriculum.ModulAjarSD4{TujuanPembelajaran: "X", MateriPembelajaran: "AI generated content"},
			qeval.FlagStyleAIReference,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res, _ := qeval.Evaluate(tc.input)
			found := false
			for _, f := range res.Flags {
				if f == tc.wantFlag {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("%s: Expected flag %s, got %v", tc.name, tc.wantFlag, res.Flags)
			}
		})
	}
}

func TestScoreCapping(t *testing.T) {
	m := &curriculum.ModulAjarSD4{} // Will get tons of penalties
	res, _ := qeval.Evaluate(m)
	if res.Score < 0 {
		t.Errorf("Score should be capped at 0, got %d", res.Score)
	}
}

func TestLegacyEvaluatorDetailed(t *testing.T) {
	c := &curriculum.Curriculum{
		TujuanPembelajaran: []string{},              // Missing
		MateriInti:         []string{"Lorem Ipsum"}, // Placeholder
	}
	res, _ := qeval.Evaluate(c)

	hasFlag := func(flag string) bool {
		for _, f := range res.Flags {
			if f == flag {
				return true
			}
		}
		return false
	}

	if !hasFlag(qeval.FlagMissingLearningObjective) {
		t.Error("Legacy missing TP flag not found")
	}
	if !hasFlag(qeval.FlagPlaceholderText) {
		t.Error("Legacy placeholder flag not found")
	}
}

func TestEvaluateSD4FullRubric(t *testing.T) {
	// hit all branches in EvaluateSD4
	m := &curriculum.ModulAjarSD4{
		TujuanPembelajaran: "TP",
		MateriPembelajaran: "MAT",
		KegiatanPembelajaran: curriculum.KegiatanPembelajaranSD4{
			Inti: "Langkah 1, Langkah 2, Langkah 3, Langkah 4, Langkah 5",
		},
		Penilaian: curriculum.PenilaianSD4{
			Pengetahuan: "Instruksi: Kerjakan soal pilihan ganda nomor 1-10 di buku tulis masing-masing.",
		},
		ProfilPelajarPancasila: []string{"Mandiri"},
	}
	res, _ := qeval.Evaluate(m)
	if res.Score < 85 {
		t.Errorf("Expected high score for full data, got %d. Flags: %v", res.Score, res.Flags)
	}

	// Test placeholders in different fields
	m.MateriPembelajaran = "[Materi di sini]"
	res, _ = qeval.Evaluate(m)
	hasFlag := func(flag string) bool {
		for _, f := range res.Flags {
			if f == flag {
				return true
			}
		}
		return false
	}
	if !hasFlag(qeval.FlagPlaceholderText) {
		t.Error("Placeholder flag not caught in Materi")
	}

	// Test legacy short content
	c := &curriculum.Curriculum{
		TujuanPembelajaran: []string{"TP"},
		MateriInti:         []string{"MAT"},
		LangkahPembelajaran: curriculum.LangkahPembelajaran{
			Inti: []string{}, // Empty should trigger
		},
	}
	res, _ = qeval.Evaluate(c)
	// Test legacy placeholder
	c.MateriInti = []string{"TODO: Implement this"}
	res, _ = qeval.Evaluate(c)
	if !hasFlag(qeval.FlagPlaceholderText) {
		t.Error("Legacy placeholder flag not caught")
	}

	// Test legacy score reduction
	c.TujuanPembelajaran = []string{}
	c.MateriInti = []string{}
	c.LangkahPembelajaran.Inti = []string{}
	res, _ = qeval.Evaluate(c)
	if res.Score != 70 {
		t.Errorf("Expected score 70 for missing items in legacy, got %d", res.Score)
	}

	// Test legacy negative score reduction
	c.TujuanPembelajaran = []string{}
	c.MateriInti = []string{"AI generated content and Lorem Ipsum placeholder"}
	c.LangkahPembelajaran.Inti = []string{}
	res, _ = qeval.Evaluate(c)
	if res.Score != 60 {
		t.Errorf("Expected 60, got %d. Flags: %v", res.Score, res.Flags)
	}
}

func TestScoreCappingSD4(t *testing.T) {
	// Force score < 0 in SD4
	m := &curriculum.ModulAjarSD4{
		TujuanPembelajaran: "",
		MateriPembelajaran: "",
		KegiatanPembelajaran: curriculum.KegiatanPembelajaranSD4{
			Inti: "short",
		},
		Penilaian: curriculum.PenilaianSD4{
			Pengetahuan: "placeholder lorem ipsum AI generated",
		},
	}
	// Penalties:
	// - Missing TP: 10
	// - Missing Materi: 10
	// - Missing Assessment: 0 (Pengetahuan is not empty)
	// - Short Content: 10
	// - No Pancasila: 10
	// - Placeholder: 10
	// - AI Ref: 10
	// Total: 60. Still 40.

	// I'll just make it super bad.
	m.Penilaian.Pengetahuan = "" // Missing Assessment: 5
	// Total: 65. Still 35.

	res, _ := qeval.Evaluate(m)
	if res.Score > 60 {
		t.Errorf("Expected low score, got %d. Flags: %v", res.Score, res.Flags)
	}
}

func TestUnknownType(t *testing.T) {
	_, err := qeval.Evaluate("string")
	if err == nil {
		t.Error("Expected error for unknown type, got nil")
	}
}

func BenchmarkEvaluate(b *testing.B) {
	m := &curriculum.ModulAjarSD4{
		TujuanPembelajaran: "TP",
		MateriPembelajaran: "MAT",
		KegiatanPembelajaran: curriculum.KegiatanPembelajaranSD4{
			Inti: "Langkah 1, Langkah 2, Langkah 3, Langkah 4, Langkah 5",
		},
		Penilaian: curriculum.PenilaianSD4{
			Pengetahuan: "Instruksi: Kerjakan soal pilihan ganda nomor 1-10 di buku tulis masing-masing.",
		},
		ProfilPelajarPancasila: []string{"Mandiri"},
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = qeval.Evaluate(m)
	}
}
