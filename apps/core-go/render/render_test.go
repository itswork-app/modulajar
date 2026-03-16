package render

import (
	"crypto/sha256"
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"modulajar/apps/core-go/curriculum"
	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
)

func templateDir() string {
	return filepath.Join("..", "templates", "v1")
}

func buildTestPlanResult() *planner.PlannerResult {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	pack, err := packloader.LoadPack(packPath)
	if err != nil {
		panic("failed to load pack for test: " + err.Error())
	}

	config := planner.DefaultConfig()
	config.Semester = "S1"

	result, err := planner.Plan(planner.PlannerInput{Pack: pack, Config: config})
	if err != nil {
		panic("planner failed: " + err.Error())
	}
	return result
}

func TestBuildATPTable(t *testing.T) {
	result := buildTestPlanResult()

	html := BuildATPTable(result, "BI")
	if html == "" {
		t.Fatal("ATP table is empty")
	}

	if !strings.Contains(html, "atp-table") {
		t.Error("missing atp-table class")
	}
}

func TestComposeModulAjarHTML(t *testing.T) {
	result := buildTestPlanResult()

	html, err := ComposeModulAjarHTML(ComposerInput{
		TemplateDir: templateDir(),
		SubjectCode: "BI",
		SubjectName: "Bahasa Indonesia",
		Title:       "Modul Ajar BI",
		TeacherName: "Ani Susanti",
		SchoolName:  "SDN 1",
		Kelas:       "4",
		Semester:    "1",
		TahunAjaran: "2025/2026",
		PID:         "PKG-TEST-001",
		DID:         "DOC-TEST-001",
		VerifyURL:   "https://example.com/verify/1",
		PlanResult:  result,
	})
	if err != nil {
		t.Fatalf("ComposeModulAjarHTML error: %v", err)
	}

	if len(html) == 0 {
		t.Fatal("Composed HTML is empty")
	}

	if HasUnresolvedPlaceholders(html) {
		t.Error("HTML contains unresolved placeholders")
	}
}

func TestComposeWithAIContent(t *testing.T) {
	result := buildTestPlanResult()
	html, err := ComposeModulAjarHTML(ComposerInput{
		TemplateDir: templateDir(),
		SubjectCode: "MAT",
		SubjectName: "Matematika",
		PlanResult:  result,
		ModulAjarMerdeka: &curriculum.ModulAjarMerdeka{
			Identitas: curriculum.IdentitasMerdeka{
				Topik:         "Penjumlahan",
				MataPelajaran: "Matematika SD",
				Kelas:         4,
				Semester:      "1",
			},
			TujuanPembelajaran: "Siswa dapat berhitung",
			MateriPembelajaran: "Penjumlahan Dasar",
			KegiatanPembelajaran: curriculum.KegiatanPembelajaranMerdeka{
				Pendahuluan: "Apersepsi",
				Inti:        "Belajar",
				Penutup:     "Doa",
			},
			Penilaian: curriculum.PenilaianMerdeka{
				Sikap:       "Baik",
				Pengetahuan: "Tes",
			},
			PemahamanBermakna: "Pentingnya berhitung",
			PertanyaanPemantik: []string{"Berapa satu tambah satu?"},
			Lampiran: curriculum.LampiranMerdeka{
				Glosarium:     "Tambah = plus",
				DaftarPustaka: "Buku Paket",
			},
		},
	})
	if err != nil {
		t.Fatalf("Failed to compose with AI: %v", err)
	}
	if !strings.Contains(html, "Penjumlahan") {
		t.Error("Missing AI topic name")
	}
	if !strings.Contains(html, "Pentingnya berhitung") {
		t.Error("Missing AI pemahaman bermakna")
	}
}

func TestComposerDeterministic(t *testing.T) {
	result := buildTestPlanResult()

	input := ComposerInput{
		TemplateDir: templateDir(),
		SubjectCode: "MTK",
		SubjectName: "Matematika",
		PlanResult:  result,
	}

	html1, _ := ComposeModulAjarHTML(input)
	html2, _ := ComposeModulAjarHTML(input)

	hash1 := fmt.Sprintf("%x", sha256.Sum256([]byte(html1)))
	hash2 := fmt.Sprintf("%x", sha256.Sum256([]byte(html2)))

	if hash1 != hash2 {
		t.Fatalf("NOT DETERMINISTIC: hash1=%s hash2=%s", hash1, hash2)
	}
}

func TestIsPDFRenderAvailable(t *testing.T) {
	_ = IsPDFRenderAvailable()
}
