package curriculum

import (
	"testing"
)

func TestTemplateSchemaValid(t *testing.T) {
	subjects := []string{"MAT", "BIN", "IPAS", "PPKN"}
	for _, code := range subjects {
		m, err := LoadTemplateSD4Struct(code)
		if err != nil {
			t.Errorf("LoadTemplateSD4Struct(%s) failed: %v", code, err)
			continue
		}
		if m == nil {
			t.Errorf("LoadTemplateSD4Struct(%s) returned nil", code)
		}
	}
}

func TestTemplateFieldsRequired(t *testing.T) {
	// Empty module should fail validation
	m := &ModulAjarSD4{}
	err := ValidateModulAjar(m)
	if err == nil {
		t.Error("expected validation error for empty module")
	}
}

func TestValidateModulAjar_AllRequired(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran: "Siswa dapat memahami konsep dasar penjumlahan",
		MateriPembelajaran: "Penjumlahan bilangan bulat dua digit",
		KegiatanPembelajaran: KegiatanPembelajaranSD4{
			Inti: "Guru menjelaskan konsep penjumlahan dengan alat peraga",
		},
		Penilaian: PenilaianSD4{
			Pengetahuan: "Tes tertulis pilihan ganda dan isian singkat",
		},
		ProfilPelajarPancasila: []string{"Bernalar kritis"},
		SaranaPrasarana:        []string{"Papan tulis"},
	}
	err := ValidateModulAjar(m)
	if err != nil {
		t.Errorf("expected valid module, got error: %v", err)
	}
}

func TestEvaluatorRejectsShortText(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran: "short",
	}
	err := EvaluateModulAjar(m)
	if err == nil {
		t.Error("expected evaluator to reject short tujuan_pembelajaran")
	}
}

func TestEvaluatorRejectsPlaceholders(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran: "Lorem ipsum dolor sit amet, ini adalah contoh teks placeholder.",
	}
	err := EvaluateModulAjar(m)
	if err == nil {
		t.Error("expected evaluator to reject placeholder content")
	}
}

func TestEvaluatorRejectsAIReference(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran: "Siswa dapat memahami bahwa saya adalah AI yang membantu.",
	}
	err := EvaluateModulAjar(m)
	if err == nil {
		t.Error("expected evaluator to reject AI self-reference")
	}
}

func TestEvaluatorRejectsMarkdown(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran: "## Heading dalam teks yang seharusnya plain text biasa.",
	}
	err := EvaluateModulAjar(m)
	if err == nil {
		t.Error("expected evaluator to reject markdown syntax")
	}
}

func TestEvaluatorAcceptsGoodContent(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran:     "Siswa mampu memahami dan menerapkan konsep pecahan sederhana dalam kehidupan sehari-hari.",
		MateriPembelajaran:     "Pecahan sederhana, perbandingan pecahan, dan operasi dasar pecahan.",
		KompetensiAwal:         "Siswa sudah memahami konsep bilangan bulat dan operasi dasar matematika.",
		KegiatanPembelajaran:   KegiatanPembelajaranSD4{Inti: "Guru menggunakan alat peraga untuk mendemonstrasikan konsep pecahan kepada siswa secara interaktif."},
		Penilaian:              PenilaianSD4{Pengetahuan: "Tes tertulis berupa soal pilihan ganda dan isian singkat tentang pecahan sederhana."},
		RefleksiGuru:           "Guru merefleksikan apakah pendekatan yang digunakan sudah efektif untuk seluruh siswa.",
		TargetPesertaDidik:     "Siswa kelas 4 SD dengan kemampuan matematika dasar yang sudah baik.",
		ModelPembelajaran:      "Pembelajaran berbasis masalah dan diskusi kelompok kecil.",
		ProfilPelajarPancasila: []string{"Bernalar kritis"},
		SaranaPrasarana:        []string{"Papan tulis dan alat peraga"},
	}
	err := EvaluateModulAjar(m)
	if err != nil {
		t.Errorf("expected valid content, got error: %v", err)
	}
}

func TestSanitizeModulAjar(t *testing.T) {
	m := &ModulAjarSD4{
		TujuanPembelajaran:     "  Siswa <b>dapat</b> memahami  konsep  ",
		MateriPembelajaran:     "```json\nMateri inti\n```",
		ProfilPelajarPancasila: []string{"  Bernalar  kritis  "},
		SaranaPrasarana:        []string{"<p>Papan tulis</p>"},
	}
	SanitizeModulAjar(m)

	if m.TujuanPembelajaran != "Siswa dapat memahami konsep" {
		t.Errorf("unexpected sanitized tujuan: %q", m.TujuanPembelajaran)
	}
	if m.MateriPembelajaran != "Materi inti" {
		t.Errorf("unexpected sanitized materi: %q", m.MateriPembelajaran)
	}
	if m.ProfilPelajarPancasila[0] != "Bernalar kritis" {
		t.Errorf("unexpected sanitized profil: %q", m.ProfilPelajarPancasila[0])
	}
	if m.SaranaPrasarana[0] != "Papan tulis" {
		t.Errorf("unexpected sanitized sarana: %q", m.SaranaPrasarana[0])
	}
}

func TestRendererDeterministicHash(t *testing.T) {
	tmpl := `<h1>{{.Title}}</h1><p>{{.Body}}</p>`
	data := map[string]string{"Title": "Modul Ajar", "Body": "Matematika SD Kelas 4"}

	_, hash1, err := RenderHTML(data, tmpl, nil)
	if err != nil {
		t.Fatalf("RenderHTML 1 failed: %v", err)
	}

	_, hash2, err := RenderHTML(data, tmpl, nil)
	if err != nil {
		t.Fatalf("RenderHTML 2 failed: %v", err)
	}

	if hash1 != hash2 {
		t.Errorf("Expected same hash, got %s vs %s", hash1, hash2)
	}
}

func TestHasTemplateSD4(t *testing.T) {
	if !HasTemplateSD4("MAT") {
		t.Error("expected MAT to have template")
	}
	if !HasTemplateSD4("mat") {
		t.Error("expected case insensitive match")
	}
	if HasTemplateSD4("UNKNOWN") {
		t.Error("expected UNKNOWN to not have template")
	}
}

func TestLoadTemplateSD4_InvalidCode(t *testing.T) {
	_, err := LoadTemplateSD4("NONEXISTENT")
	if err == nil {
		t.Error("expected error for nonexistent subject code")
	}
}
