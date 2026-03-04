package dataset

import (
	"modulajar/apps/core-go/curriculum"
)

// Anonymize removes sensitive information from the curriculum data.
func Anonymize(m interface{}) {
	switch v := m.(type) {
	case *curriculum.ModulAjarSD4:
		v.Identitas.Sekolah = ""
		// Other fields like NIP, address, etc. aren't in the struct
		// but if they were in any other free-text fields we might need regex.
		// For now, based on struct fields:
		v.Identitas.Sekolah = ""
	case *curriculum.Curriculum:
		v.Identitas.Sekolah = ""
		v.Identitas.Guru = ""
	}
}
