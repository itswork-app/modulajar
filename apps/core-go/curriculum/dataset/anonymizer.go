package dataset

import (
	"modulajar/apps/core-go/curriculum"
	"strings"
)

// AnonymizeModulAjar removes sensitive information from the curriculum data.
func AnonymizeModulAjar(m *curriculum.ModulAjarMerdeka) {
	m.Identitas.NamaGuru = maskTeacher(m.Identitas.NamaGuru)
	m.Identitas.Sekolah = strings.TrimSpace(m.Identitas.Sekolah)
}

func maskTeacher(name string) string {
	if name == "" {
		return ""
	}
	parts := strings.Split(name, " ")
	for i, p := range parts {
		if len(p) > 1 {
			parts[i] = string(p[0]) + strings.Repeat("*", len(p)-1)
		}
	}
	return strings.Join(parts, " ")
}
