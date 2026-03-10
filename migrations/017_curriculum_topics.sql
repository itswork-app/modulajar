-- +goose Up
CREATE TABLE curriculum_topics (
    id VARCHAR(30) PRIMARY KEY,
    jenjang VARCHAR(20) NOT NULL,
    fase VARCHAR(5) NOT NULL,
    kelas INTEGER NOT NULL,
    mata_pelajaran VARCHAR(100) NOT NULL,
    semester INTEGER,
    title VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    cp_reference TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_curriculum_topics_filtering ON curriculum_topics(jenjang, kelas, mata_pelajaran, semester);

-- +goose Down
DROP INDEX IF EXISTS idx_curriculum_topics_filtering;
DROP TABLE IF EXISTS curriculum_topics;
