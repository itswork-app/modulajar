package curriculum

import (
	"strings"
	"testing"
)

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		base    Curriculum
		errPart string
	}{
		{"Empty", Curriculum{}, "meta.jenjang is required"},
		{"Missing Kelas", Curriculum{Meta: Meta{Jenjang: "SD"}}, "meta.kelas is required"},
		{"Missing Mapel", Curriculum{Meta: Meta{Jenjang: "SD", Kelas: "1"}}, "meta.mapel is required"},
		{"Missing TP", Curriculum{Meta: Meta{Jenjang: "SD", Kelas: "1", Mapel: "A"}}, "tujuan_pembelajaran is required"},
		{"Missing Materi", Curriculum{Meta: Meta{Jenjang: "SD", Kelas: "1", Mapel: "A"}, TujuanPembelajaran: []string{"T"}}, "materi_inti is required"},
		{"Missing Inti", Curriculum{Meta: Meta{Jenjang: "SD", Kelas: "1", Mapel: "A"}, TujuanPembelajaran: []string{"T"}, MateriInti: []string{"M"}}, "langkah_pembelajaran.inti is required"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.base.Validate()
			if err == nil || !strings.Contains(err.Error(), tt.errPart) {
				t.Errorf("expected error containing %q, got %v", tt.errPart, err)
			}
		})
	}

	// Success case
	valid := Curriculum{
		Meta:               Meta{Jenjang: "SD", Kelas: "1", Mapel: "A"},
		TujuanPembelajaran: []string{"T"},
		MateriInti:         []string{"M"},
		LangkahPembelajaran: LangkahPembelajaran{
			Inti: []string{"I"},
		},
	}
	if err := valid.Validate(); err != nil {
		t.Errorf("Unexpected validation error: %v", err)
	}
}

func TestSanitize(t *testing.T) {
	c := &Curriculum{
		Meta: Meta{
			Mapel: "<script>alert(1)</script> Math",
		},
		TujuanPembelajaran: []string{
			"  Point 1  ",
			"Point <b>2</b>",
			"```json\nPoint 3\n```",
		},
	}
	c.Sanitize()

	if c.Meta.Mapel != "alert(1) Math" {
		t.Errorf("Sanitization failed for Mapel: %s", c.Meta.Mapel)
	}
	if c.TujuanPembelajaran[0] != "Point 1" {
		t.Errorf("Whitespace normalization failed: '%s'", c.TujuanPembelajaran[0])
	}
	if c.TujuanPembelajaran[1] != "Point 2" {
		t.Errorf("HTML stripping failed: '%s'", c.TujuanPembelajaran[1])
	}
	if c.TujuanPembelajaran[2] != "Point 3" {
		t.Errorf("Markdown stripping failed: '%s'", c.TujuanPembelajaran[2])
	}
}

func TestRenderHTML(t *testing.T) {
	c := &Curriculum{
		Meta:               Meta{Mapel: "Test Mapel"},
		TujuanPembelajaran: []string{"Goal 1"},
	}
	tmpl := "<h1>{{.Meta.Mapel}}</h1><ul>{{range .TujuanPembelajaran}}<li>{{.}}</li>{{end}}</ul>"

	html, hash, err := RenderHTML(c, tmpl, nil)
	if err != nil {
		t.Fatalf("RenderHTML failed: %v", err)
	}

	if !strings.Contains(html, "<h1>Test Mapel</h1>") {
		t.Errorf("HTML missing content: %s", html)
	}
	if hash == "" {
		t.Error("Hash is empty")
	}

	// Determinism
	_, hash2, _ := RenderHTML(c, tmpl, nil)
	if hash != hash2 {
		t.Error("Hash mismatch for identical input")
	}
}
