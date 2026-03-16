package dataset

import (
	"modulajar/apps/core-go/curriculum"
	"testing"
)

func TestAnonymization(t *testing.T) {
	t.Run("ModulAjarMerdeka", func(t *testing.T) {
		m := &curriculum.ModulAjarMerdeka{
			Identitas: curriculum.IdentitasMerdeka{
				NamaGuru: "Budi Santoso",
				Sekolah:  " SD Elite ",
			},
		}
		AnonymizeModulAjar(m)
		if m.Identitas.NamaGuru != "B*** S******" {
			t.Errorf("expected masked name, got %q", m.Identitas.NamaGuru)
		}
		if m.Identitas.Sekolah != "SD Elite" {
			t.Errorf("expected trimmed school name, got %q", m.Identitas.Sekolah)
		}
	})
}
