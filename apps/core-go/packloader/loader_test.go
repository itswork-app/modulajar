package packloader

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadPack(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	pack, err := LoadPack(packPath)
	if err != nil {
		t.Fatalf("LoadPack failed: %v", err)
	}

	// Verify metadata
	if pack.PackID != "merdeka-sd4-v1" {
		t.Errorf("expected pack_id 'merdeka-sd4-v1', got '%s'", pack.PackID)
	}
	if pack.Name != "Kurikulum Merdeka SD Kelas 4" {
		t.Errorf("expected name 'Kurikulum Merdeka SD Kelas 4', got '%s'", pack.Name)
	}
	if pack.Version != "v1" {
		t.Errorf("expected version 'v1', got '%s'", pack.Version)
	}
	if pack.Jenjang != "SD" {
		t.Errorf("expected jenjang 'SD', got '%s'", pack.Jenjang)
	}
	if pack.Kelas != "4" {
		t.Errorf("expected kelas '4', got '%s'", pack.Kelas)
	}

	// Verify subjects
	if len(pack.Subjects) != 6 {
		t.Fatalf("expected 6 subjects, got %d", len(pack.Subjects))
	}

	expectedCodes := []string{"BI", "MTK", "IPAS", "PPKN", "SBK", "PJOK"}
	for i, code := range expectedCodes {
		if pack.Subjects[i].Code != code {
			t.Errorf("subject[%d]: expected code '%s', got '%s'", i, code, pack.Subjects[i].Code)
		}
	}

	// Verify each subject has outcomes (PR-005 requirement)
	for i, s := range pack.Subjects {
		if len(s.Outcomes) == 0 {
			t.Errorf("subject[%d] '%s': expected outcomes > 0, got 0", i, s.Code)
		}
		t.Logf("subject '%s': %d outcomes", s.Code, len(s.Outcomes))

		// Verify each outcome has required fields
		for j, o := range s.Outcomes {
			if o.Code == "" {
				t.Errorf("subject[%d].outcome[%d]: missing code", i, j)
			}
			if o.Description == "" {
				t.Errorf("subject[%d].outcome[%d]: missing description", i, j)
			}
		}
	}
}

func TestLoadPackMissingFields(t *testing.T) {
	// Create a temp file with missing required fields
	content := []byte(`{"name": "Test Pack"}`)
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "invalid.json")
	if err := os.WriteFile(tmpFile, content, 0644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	_, err := LoadPack(tmpFile)
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
}

func TestLoadPackFileNotFound(t *testing.T) {
	_, err := LoadPack("/nonexistent/path/pack.json")
	if err == nil {
		t.Fatal("expected file not found error, got nil")
	}
}
func TestLoadPackMalformedJSON(t *testing.T) {
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "malformed.json")
	if err := os.WriteFile(tmpFile, []byte(`{invalid: json}`), 0644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	_, err := LoadPack(tmpFile)
	if err == nil {
		t.Fatal("expected json decode error, got nil")
	}
}

func TestLoadPackValidation_AllFields(t *testing.T) {
	base := CurriculumPack{
		PackID:   "test",
		Name:     "Test",
		Version:  "v1",
		Jenjang:  "SD",
		Kelas:    "4",
		Subjects: []Subject{{Code: "BI", Name: "Bahasa Indonesia"}},
	}

	tests := []struct {
		name   string
		modify func(*CurriculumPack)
	}{
		{"missing pack_id", func(p *CurriculumPack) { p.PackID = "" }},
		{"missing name", func(p *CurriculumPack) { p.Name = "" }},
		{"missing version", func(p *CurriculumPack) { p.Version = "" }},
		{"missing jenjang", func(p *CurriculumPack) { p.Jenjang = "" }},
		{"missing kelas", func(p *CurriculumPack) { p.Kelas = "" }},
		{"empty subjects", func(p *CurriculumPack) { p.Subjects = nil }},
		{"subject missing code", func(p *CurriculumPack) { p.Subjects = []Subject{{Code: "", Name: "X"}} }},
		{"subject missing name", func(p *CurriculumPack) { p.Subjects = []Subject{{Code: "X", Name: ""}} }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pack := base // copy
			pack.Subjects = make([]Subject, len(base.Subjects))
			copy(pack.Subjects, base.Subjects)
			tt.modify(&pack)

			err := validate(&pack)
			if err == nil {
				t.Errorf("expected validation error for %s, got nil", tt.name)
			}
		})
	}
}

func TestLoadPackValidation_Success(t *testing.T) {
	pack := &CurriculumPack{
		PackID:   "test",
		Name:     "Test",
		Version:  "v1",
		Jenjang:  "SD",
		Kelas:    "4",
		Subjects: []Subject{{Code: "BI", Name: "Bahasa Indonesia"}},
	}

	err := validate(pack)
	if err != nil {
		t.Errorf("expected no error for valid pack, got %v", err)
	}
}
