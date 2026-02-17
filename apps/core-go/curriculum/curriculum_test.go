package curriculum

import (
	"strings"
	"testing"
)

func TestValidate(t *testing.T) {
	c := &Curriculum{}
	if err := c.Validate(); err == nil {
		t.Error("Expected validation error for empty curriculum")
	}

	c.Meta.Jenjang = "SD"
	c.Meta.Kelas = "1"
	c.Meta.Mapel = "Math"
	c.TujuanPembelajaran = []string{"A"}
	c.MateriInti = []string{"B"}
	c.LangkahPembelajaran.Inti = []string{"C"}

	if err := c.Validate(); err != nil {
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

	html, hash, err := RenderHTML(c, tmpl)
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
	_, hash2, _ := RenderHTML(c, tmpl)
	if hash != hash2 {
		t.Error("Hash mismatch for identical input")
	}
}
