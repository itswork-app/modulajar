# Dataset Collector System (PR-062)

The Dataset Collector automatically harvest high-quality Modul Ajar outputs (Human-Refined candidates) to build a platform-wide knowledge base. This data is intended for future template ranking (PR-063) and AI refinement.

## Pipeline Overview

1.  **AI Generation**: AI produces a curriculum JSON.
2.  **Quality Evaluation**: The `qeval` package (PR-061) scores the output.
3.  **Threshold Gate**: Only modules with `Score ≥ 80` are considered for the dataset.
4.  **Anonymization**: Sensitive fields (`teacher_name`, `school_name`) are stripped to protect privacy.
5.  **Deduplication**: SHA256 hashing of the module content prevents duplicate entries.
6.  **Persistence**: High-quality candidates are stored in the `curriculum_dataset` table.

## Database Schema

```sql
CREATE TABLE curriculum_dataset (
    id UUID PRIMARY KEY,
    subject TEXT NOT NULL,
    grade INT NOT NULL,
    topic TEXT NOT NULL,
    module_json JSONB NOT NULL,
    quality_score INT NOT NULL,
    original_hash TEXT UNIQUE NOT NULL,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Privacy & Security

The anonymization layer in `apps/core-go/curriculum/dataset/anonymizer.go` ensures that:
- `IdentitasSD4.Sekolah` is cleared.
- Legacy `Identitas.Guru` and `Identitas.Sekolah` are cleared.
- No `workspace_id` or `user_id` is stored in the dataset table.

## Observability

### Prometheus Metrics
- `dataset_candidate_total`: Total modules eligible for collection.
- `dataset_insert_total`: Total modules successfully saved.
- `dataset_duplicate_skipped`: Modules skipped due to hash collision.
- `dataset_rejected_quality`: Modules that failed the score threshold (80).

### Structured Logs
Example log on successful collection:
```json
{"event": "dataset_collected", "subject": "Math", "grade": 4, "score": 85}
```
