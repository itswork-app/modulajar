package ranking

import (
	"context"
	"fmt"
	"modulajar/apps/core-go/db"
	"testing"

	"github.com/google/uuid"
)

func TestComputeSimilarity(t *testing.T) {
	tests := []struct {
		name   string
		topicA string
		topicB string
		want   float64
	}{
		{"Identical", "pecahan matematika", "pecahan matematika", 1.0},
		{"Partial Match", "pecahan matematika", "operasi pecahan", 0.3333333333333333}, // {pecahan, matematika} vs {operasi, pecahan} -> intersection=1, union=3
		{"No Match", "pecahan", "tata surya", 0.0},
		{"Empty A", "", "pecahan", 0.0},
		{"Empty B", "pecahan", "", 0.0},
		{"Both Empty", "", "", 1.0},
		{"Case Insensitive", "Pecahan", "pecahan", 1.0},
		{"Single Char Skip", "a pecahan", "b pecahan", 1.0}, // 'a' and 'b' skipped
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputeSimilarity(tt.topicA, tt.topicB)
			if got != tt.want {
				t.Errorf("ComputeSimilarity() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCalculateScore(t *testing.T) {
	tests := []struct {
		name       string
		quality    int
		usage      int
		similarity float64
		// We use a range or approximate check because of floats
		min float64
		max float64
	}{
		{"Perfect Match", 100, 100, 1.0, 98.0, 100.1},            // 60 + 20 + 20 = 100
		{"High Quality Low Similarity", 90, 0, 0.0, 53.0, 55.0},  // 54 + 0 + 0 = 54
		{"Low Quality High Similarity", 50, 10, 1.0, 58.0, 62.0}, // 30 + ~10.4 + 20 = 60.4
		{"Cap Usage Score", 100, 1000000, 0.0, 79.9, 80.1},       // 60 + 20 (cap) + 0 = 80
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateScore(tt.quality, tt.usage, tt.similarity)
			if got < tt.min || got > tt.max {
				t.Errorf("CalculateScore() = %v, want range [%v, %v]", got, tt.min, tt.max)
			}
		})
	}
}

func TestSelectTopTemplates(t *testing.T) {
	candidates := []TemplateCandidate{
		{ID: uuid.New(), Topic: "pecahan dasar", QualityScore: 90, UsageCount: 10},
		{ID: uuid.New(), Topic: "operasi hitung pecahan", QualityScore: 85, UsageCount: 50},
		{ID: uuid.New(), Topic: "tata surya", QualityScore: 95, UsageCount: 5},
		{ID: uuid.New(), Topic: "pecahan senilai", QualityScore: 80, UsageCount: 100},
	}

	target := "penjumlahan pecahan"

	results := SelectTopTemplates(candidates, target)

	if len(results) != 3 {
		t.Errorf("Expected 3 results, got %d", len(results))
	}

	// Verify order (approximate based on topic overlap)
	// target: {penjumlahan, pecahan}
	// "pecahan dasar": {pecahan, dasar} -> sim 0.33
	// "operasi hitung pecahan": {operasi, hitung, pecahan} -> sim 0.25
	// "tata surya": {tata, surya} -> sim 0.0
	// "pecahan senilai": {pecahan, senilai} -> sim 0.33

	if results[0].Candidate.Topic == "tata surya" {
		t.Error("Least relevant template ranked first")
	}

	for i := 0; i < len(results)-1; i++ {
		if results[i].RankScore < results[i+1].RankScore {
			t.Errorf("Results not sorted: index %d score %v < index %d score %v", i, results[i].RankScore, i+1, results[i+1].RankScore)
		}
	}
}

func TestSelectTopTemplates_Empty(t *testing.T) {
	if results := SelectTopTemplates(nil, "topic"); results != nil {
		t.Error("Expected nil for nil candidates")
	}
}

func TestGetTemplateCandidates(t *testing.T) {
	// Mock DB
	originalDBQuery := DBQuery
	defer func() { DBQuery = originalDBQuery }()

	mockEntry := db.DatasetEntry{
		ID:           uuid.New().String(),
		Subject:      "Math",
		Grade:        4,
		Topic:        "Topic 1",
		QualityScore: 90,
		UsageCount:   5,
		ModuleJSON:   []byte(`{}`),
	}

	DBQuery = func(ctx context.Context, subject string, grade int) ([]db.DatasetEntry, error) {
		return []db.DatasetEntry{mockEntry}, nil
	}

	candidates, err := GetTemplateCandidates(context.Background(), "Math", 4)
	if err != nil {
		t.Fatal(err)
	}

	if len(candidates) != 1 {
		t.Fatalf("Expected 1 candidate, got %d", len(candidates))
	}

	if candidates[0].QualityScore != 90 {
		t.Errorf("Expected QualityScore 90, got %d", candidates[0].QualityScore)
	}
}

func TestGetTemplateCandidates_Error(t *testing.T) {
	// Mock DB Failure
	originalDBQuery := DBQuery
	defer func() { DBQuery = originalDBQuery }()

	DBQuery = func(ctx context.Context, subject string, grade int) ([]db.DatasetEntry, error) {
		return nil, fmt.Errorf("db error")
	}

	_, err := GetTemplateCandidates(context.Background(), "Math", 4)
	if err == nil {
		t.Error("Expected error from GetTemplateCandidates")
	}
}

func TestGetTemplateCandidates_InvalidUUID(t *testing.T) {
	// Mock DB with invalid UUID
	originalDBQuery := DBQuery
	defer func() { DBQuery = originalDBQuery }()

	DBQuery = func(ctx context.Context, subject string, grade int) ([]db.DatasetEntry, error) {
		return []db.DatasetEntry{
			{ID: "invalid-uuid", Subject: "Math", Grade: 4},
		}, nil
	}

	candidates, err := GetTemplateCandidates(context.Background(), "Math", 4)
	if err != nil {
		t.Fatal(err)
	}

	if len(candidates) != 0 {
		t.Errorf("Expected 0 candidates due to invalid UUID, got %d", len(candidates))
	}
}

// === Preview Builder Tests ===

func TestBuildPreview_FullModule(t *testing.T) {
	moduleJSON := []byte(`{
		"tujuan_pembelajaran": "Siswa dapat membandingkan pecahan.",
		"kegiatan_pembelajaran": {"inti": "Eksplorasi dengan benda konkret."},
		"penilaian": {"pengetahuan": "Tes tertulis membandingkan pecahan."}
	}`)

	p := BuildPreview(moduleJSON)
	if p.TujuanPembelajaran != "Siswa dapat membandingkan pecahan." {
		t.Errorf("tujuan mismatch: %s", p.TujuanPembelajaran)
	}
	if p.RingkasanKegiatan != "Eksplorasi dengan benda konkret." {
		t.Errorf("kegiatan mismatch: %s", p.RingkasanKegiatan)
	}
	if p.AssessmentSummary != "Tes tertulis membandingkan pecahan." {
		t.Errorf("assessment mismatch: %s", p.AssessmentSummary)
	}
}

func TestBuildPreview_InvalidJSON(t *testing.T) {
	p := BuildPreview([]byte("not json"))
	if p.TujuanPembelajaran != "" || p.RingkasanKegiatan != "" || p.AssessmentSummary != "" {
		t.Error("Expected empty preview for invalid JSON")
	}
}

func TestBuildPreview_Empty(t *testing.T) {
	p := BuildPreview([]byte(`{}`))
	if p.TujuanPembelajaran != "" || p.RingkasanKegiatan != "" || p.AssessmentSummary != "" {
		t.Error("Expected empty preview for empty module")
	}
}

func TestBuildPreview_ArrayTujuan(t *testing.T) {
	moduleJSON := []byte(`{
		"tujuan_pembelajaran": ["Goal A", "Goal B"]
	}`)
	p := BuildPreview(moduleJSON)
	if p.TujuanPembelajaran != "Goal A; Goal B" {
		t.Errorf("array tujuan mismatch: %s", p.TujuanPembelajaran)
	}
}

func TestBuildPreview_StringKegiatan(t *testing.T) {
	moduleJSON := []byte(`{
		"kegiatan_pembelajaran": "Aktivitas langsung"
	}`)
	p := BuildPreview(moduleJSON)
	if p.RingkasanKegiatan != "Aktivitas langsung" {
		t.Errorf("string kegiatan mismatch: %s", p.RingkasanKegiatan)
	}
}

func TestBuildPreview_StringPenilaian(t *testing.T) {
	moduleJSON := []byte(`{
		"penilaian": "Tes tertulis dan praktik"
	}`)
	p := BuildPreview(moduleJSON)
	if p.AssessmentSummary != "Tes tertulis dan praktik" {
		t.Errorf("string penilaian mismatch: %s", p.AssessmentSummary)
	}
}

func TestTruncateStr(t *testing.T) {
	// Short string — no truncation
	if truncateStr("hello", 200) != "hello" {
		t.Error("short string should not be truncated")
	}
	// Exact length
	if truncateStr("abc", 3) != "abc" {
		t.Error("exact length should not be truncated")
	}
	// Long string — truncated with ...
	long := ""
	for i := 0; i < 250; i++ {
		long += "A"
	}
	result := truncateStr(long, 200)
	if len(result) != 200 {
		t.Errorf("expected 200 chars, got %d", len(result))
	}
	if result[197:200] != "..." {
		t.Error("expected ... at end")
	}
	// maxLen <= 3
	if truncateStr("hello world", 2) != "he" {
		t.Errorf("maxLen=2: %s", truncateStr("hello world", 2))
	}
}

func TestExtractString_NonStringNonArray(t *testing.T) {
	m := map[string]interface{}{
		"tujuan_pembelajaran": 42,
	}
	if extractString(m, "tujuan_pembelajaran") != "" {
		t.Error("expected empty for non-string non-array")
	}
}

func TestExtractNestedString_NonMapNonString(t *testing.T) {
	m := map[string]interface{}{
		"penilaian": 42,
	}
	if extractNestedString(m, "penilaian", "pengetahuan") != "" {
		t.Error("expected empty for non-map non-string")
	}
}

func TestExtractNestedString_MapWithNonStringChild(t *testing.T) {
	m := map[string]interface{}{
		"penilaian": map[string]interface{}{
			"pengetahuan": 999,
		},
	}
	if extractNestedString(m, "penilaian", "pengetahuan") != "" {
		t.Error("expected empty for non-string child")
	}
}

func BenchmarkSelectTopTemplates(b *testing.B) {
	candidates := make([]TemplateCandidate, 100)
	for i := 0; i < 100; i++ {
		candidates[i] = TemplateCandidate{
			ID:           uuid.New(),
			Subject:      "Matematika",
			Grade:        4,
			Topic:        fmt.Sprintf("Topic %d", i),
			QualityScore: 80 + (i % 20),
			UsageCount:   i,
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = SelectTopTemplates(candidates, "Aljabar")
	}
}
