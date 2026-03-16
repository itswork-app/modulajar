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
	"MTK":  "matematika.json",
	"BIN":  "bahasa_indonesia.json",
	"BI":   "bahasa_indonesia.json",
	"IPAS": "ipas.json",
	"PPKN": "ppkn.json",
}

// templateBasePath resolves the merdeka templates directory relative to this source file.
func templateBasePath() string {
	// Try environment variable first (production)
	if base := os.Getenv("TEMPLATE_BASE_PATH"); base != "" {
		return filepath.Join(base, "merdeka")
	}
	// Fall back to relative path from this source file (development/tests)
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "templates", "merdeka")
}

// LoadTemplateMerdeka loads the curriculum template for the given subject code.
// Returns the raw JSON bytes of the template.
func LoadTemplateMerdeka(subjectCode string) ([]byte, error) {
	code := strings.ToUpper(strings.TrimSpace(subjectCode))

	filename, ok := subjectFileMap[code]
	if !ok {
		return nil, fmt.Errorf("no template for subject code: %s", code)
	}

	path := filepath.Join(templateBasePath(), filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read template %s: %w", filename, err)
	}

	return data, nil
}

// LoadTemplateMerdekaStruct loads and parses the template into a ModulAjarMerdeka struct.
func LoadTemplateMerdekaStruct(subjectCode string) (*ModulAjarMerdeka, error) {
	data, err := LoadTemplateMerdeka(subjectCode)
	if err != nil {
		return nil, err
	}

	var m ModulAjarMerdeka
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("failed to parse template JSON: %w", err)
	}

	return &m, nil
}

// HasTemplateMerdeka checks if a template exists for the given subject code.
func HasTemplateMerdeka(subjectCode string) bool {
	code := strings.ToUpper(strings.TrimSpace(subjectCode))
	_, ok := subjectFileMap[code]
	return ok
}
