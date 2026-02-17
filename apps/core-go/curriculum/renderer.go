package curriculum

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html/template"
)

// RenderHTML renders the Curriculum object using the provided template content.
// It returns the rendered HTML string and its SHA256 hash.
func RenderHTML(c *Curriculum, tmplContent string) (string, string, error) {
	tmpl, err := template.New("modul-ajar").Parse(tmplContent)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, c); err != nil {
		return "", "", fmt.Errorf("failed to render template: %w", err)
	}

	html := buf.String()
	hash := sha256Sum(html)

	return html, hash, nil
}

func sha256Sum(s string) string {
	h := sha256.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}
