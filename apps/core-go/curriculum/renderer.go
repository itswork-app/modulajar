package curriculum

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html/template"
)

// RenderHTML renders the data using the provided template content and functions.
// It returns the rendered HTML string and its SHA256 hash.
func RenderHTML(data interface{}, tmplContent string, funcs template.FuncMap) (string, string, error) {
	tmpl := template.New("modul-ajar")
	if funcs != nil {
		tmpl = tmpl.Funcs(funcs)
	}
	tmpl, err := tmpl.Parse(tmplContent)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
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
