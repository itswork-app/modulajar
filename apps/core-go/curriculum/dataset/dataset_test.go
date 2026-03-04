package dataset

import (
	"context"
	"fmt"
	"modulajar/apps/core-go/curriculum"
	"modulajar/apps/core-go/db"
	"strings"
	"testing"
)

func TestAnonymize(t *testing.T) {
	t.Run("ModulAjarSD4", func(t *testing.T) {
		m := &curriculum.ModulAjarSD4{
			Identitas: curriculum.IdentitasSD4{
				Sekolah: "SDN Test",
			},
		}
		Anonymize(m)
		if m.Identitas.Sekolah != "" {
			t.Errorf("Expected Sekolah to be empty, got %q", m.Identitas.Sekolah)
		}
	})

	t.Run("LegacyCurriculum", func(t *testing.T) {
		m := &curriculum.Curriculum{
			Identitas: curriculum.Identitas{
				Sekolah: "SDN Test",
				Guru:    "Guru Test",
			},
		}
		Anonymize(m)
		if m.Identitas.Sekolah != "" {
			t.Errorf("Expected Sekolah to be empty, got %q", m.Identitas.Sekolah)
		}
		if m.Identitas.Guru != "" {
			t.Errorf("Expected Guru to be empty, got %q", m.Identitas.Guru)
		}
	})

	t.Run("UnknownTypeDoNothing", func(t *testing.T) {
		m := "just a string"
		Anonymize(m) // Should not crash
	})
}

func TestCalculateHash(t *testing.T) {
	data1 := []byte(`{"test":1}`)
	data2 := []byte(`{"test":1}`)
	data3 := []byte(`{"test":2}`)

	h1 := CalculateHash(data1)
	h2 := CalculateHash(data2)
	h3 := CalculateHash(data3)

	if h1 != h2 {
		t.Error("Hashes for identical data should match")
	}
	if h1 == h3 {
		t.Error("Hashes for different data should not match")
	}
	if len(h1) != 64 {
		t.Errorf("Expected 64-char hex hash, got %d", len(h1))
	}
}

func TestCollectDataset(t *testing.T) {
	// Backup and Restore mocked function
	oldDbInsert := DBInsert
	defer func() { DBInsert = oldDbInsert }()

	ctx := context.Background()

	t.Run("Reject Low Score", func(t *testing.T) {
		m := &curriculum.ModulAjarSD4{}
		err := CollectDataset(ctx, m, 79)
		if err != nil {
			t.Errorf("Expected no error for rejected score, got %v", err)
		}
	})

	t.Run("Accept SD4 Success", func(t *testing.T) {
		DBInsert = func(ctx context.Context, entry db.DatasetEntry) (bool, error) {
			return true, nil
		}
		m := &curriculum.ModulAjarSD4{
			Identitas: curriculum.IdentitasSD4{
				MataPelajaran: "Math",
				Kelas:         4,
				Topik:         "Algebra",
			},
		}
		err := CollectDataset(ctx, m, 85)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})

	t.Run("Accept Legacy Duplicate", func(t *testing.T) {
		DBInsert = func(ctx context.Context, entry db.DatasetEntry) (bool, error) {
			return false, nil // Duplicate
		}
		m := &curriculum.Curriculum{
			Meta: curriculum.Meta{
				Mapel: "IPA",
				Kelas: "5",
			},
		}
		err := CollectDataset(ctx, m, 90)
		if err != nil {
			t.Errorf("Expected no error for duplicate, got %v", err)
		}
	})

	t.Run("DB Error", func(t *testing.T) {
		DBInsert = func(ctx context.Context, entry db.DatasetEntry) (bool, error) {
			return false, fmt.Errorf("db boom")
		}
		m := &curriculum.ModulAjarSD4{}
		err := CollectDataset(ctx, m, 95)
		if err == nil {
			t.Error("Expected DB error, got nil")
		} else if !strings.Contains(err.Error(), "db boom") {
			t.Errorf("Expected 'db boom' error, got %v", err)
		}
	})

	t.Run("Marshal Error Case", func(t *testing.T) {
		// To trigger marshal error, we'd need a field that can't be marshaled (like a channel)
		// But our structs don't have them.
	})
}
