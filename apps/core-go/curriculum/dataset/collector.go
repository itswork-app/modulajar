package dataset

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"

	"modulajar/apps/core-go/curriculum"
	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/metrics"

	"github.com/google/uuid"
)

const ScoreThreshold = 80

// DBInsert is a variable to allow mocking in tests.
var DBInsert = db.InsertDatasetEntry

// CollectDataset processes a curriculum document for the dataset collector.
// It anonymizes the data and stores it if the quality score meets the threshold.
func CollectDataset(ctx context.Context, m interface{}, score int) error {
	// 1. Check score threshold
	if score < ScoreThreshold {
		metrics.DatasetRejectedQuality.Inc()
		return nil
	}

	metrics.DatasetCandidateTotal.Inc()

	// 2. Anonymize data
	// Note: We assume the caller provides a pointer to the curriculum struct.
	// Since collection happens after rendering/parsing, we can safely anonymize a clone or the original
	// based on pipeline needs. For safety in worker pipeline, we might want to clone if it's still needed.
	// However, the worker is usually done after this point.
	Anonymize(m)

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

	switch v := m.(type) {
	case *curriculum.ModulAjarSD4:
		subject = v.Identitas.MataPelajaran
		grade = v.Identitas.Kelas
		topic = v.Identitas.Topik
	case *curriculum.Curriculum:
		subject = v.Meta.Mapel
		grade, _ = strconv.Atoi(v.Meta.Kelas)
		topic = "Legacy Content"
	}

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
