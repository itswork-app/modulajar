-- Migration: 013_dataset_collector.sql
-- PR-062: Collect high-quality Modul Ajar outputs edited by teachers

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

-- Index for fast lookup based on subject and grade (for template ranking)
CREATE INDEX idx_dataset_subject_grade ON curriculum_dataset(subject, grade);

-- Index for ranking by quality
CREATE INDEX idx_dataset_score ON curriculum_dataset(quality_score DESC);

-- Index for deduplication (redundant because of UNIQUE constraint but good for clarity)
CREATE INDEX idx_dataset_hash ON curriculum_dataset(original_hash);

-- Trigger to update updated_at if needed, but the spec doesn't require it for now.
