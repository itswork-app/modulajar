package curriculum

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// subjectFileMap maps subject codes to template filenames.
var subjectFileMap = map[string]string{
	"MAT":  "matematika.json",
	"BIN":  "bahasa_indonesia.json",
	"IPAS": "ipas.json",
	"PPKN": "ppkn.json",
}

// templateBasePath resolves the sd4 templates directory relative to this source file.
func templateBasePath() string {
	// Try environment variable first (production)
	if base := os.Getenv("TEMPLATE_BASE_PATH"); base != "" {
		return filepath.Join(base, "sd4")
	}
	// Fall back to relative path from this source file (development/tests)
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "templates", "sd4")
}

// LoadTemplateSD4 loads the SD4 template for the given subject code.
// Returns the raw JSON bytes of the template.
func LoadTemplateSD4(subjectCode string) ([]byte, error) {
	code := strings.ToUpper(strings.TrimSpace(subjectCode))

	filename, ok := subjectFileMap[code]
	if !ok {
		return nil, fmt.Errorf("no SD4 template for subject code: %s", code)
	}

	path := filepath.Join(templateBasePath(), filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read template %s: %w", filename, err)
	}

	return data, nil
}

// LoadTemplateSD4Struct loads and parses the SD4 template into a ModulAjarSD4 struct.
func LoadTemplateSD4Struct(subjectCode string) (*ModulAjarSD4, error) {
	data, err := LoadTemplateSD4(subjectCode)
	if err != nil {
		return nil, err
	}

	var m ModulAjarSD4
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("failed to parse template JSON: %w", err)
	}

	return &m, nil
}

// HasTemplateSD4 checks if a template exists for the given subject code.
func HasTemplateSD4(subjectCode string) bool {
	code := strings.ToUpper(strings.TrimSpace(subjectCode))
	_, ok := subjectFileMap[code]
	return ok
}
