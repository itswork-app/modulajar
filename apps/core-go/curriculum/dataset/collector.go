package dataset

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"modulajar/apps/core-go/curriculum"
	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/metrics"

	"github.com/google/uuid"
)

const ScoreThreshold = 80

// DBInsert is a variable to allow mocking in tests.
var DBInsert = db.InsertDatasetEntry

// CollectDataset stores the module to dataset for further training.
func CollectDataset(ctx context.Context, m *curriculum.ModulAjarMerdeka, score int) error {
	// 1. Anonymize
	AnonymizeModulAjar(m)

	// 2. Check score threshold
	if score < ScoreThreshold {
		metrics.DatasetRejectedQuality.Inc()
		return nil
	}

	metrics.DatasetCandidateTotal.Inc()

	// 3. Convert to JSON
	moduleJSON, err := json.Marshal(m)
	if err != nil {
		return fmt.Errorf("failed to marshal curriculum for dataset: %w", err)
	}

	// 4. Deduplicate
	originalHash := CalculateHash(moduleJSON)

	// 5. Build DB entry
	var subject, topic string
	var grade int

	// Extract data from ModulAjarMerdeka
	subject = m.Identitas.MataPelajaran
	grade = m.Identitas.Kelas
	topic = m.Identitas.Topik

	entry := db.DatasetEntry{
		ID:           uuid.New().String(),
		Subject:      subject,
		Grade:        grade,
		Topic:        topic,
		ModuleJSON:   moduleJSON,
		QualityScore: score,
		OriginalHash: originalHash,
	}

	// 6. Insert dataset
	inserted, err := DBInsert(ctx, entry)
	if err != nil {
		return fmt.Errorf("failed to insert dataset entry: %w", err)
	}

	if !inserted {
		metrics.DatasetDuplicateSkipped.Inc()
		slog.Debug("dataset_duplicate_skipped", "hash", originalHash)
		return nil
	}

	slog.Info("dataset_collected", "subject", subject, "grade", grade, "score", score)
	metrics.DatasetInsertTotal.Inc()

	return nil
}
