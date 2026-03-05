-- +goose Up
-- +goose StatementBegin

-- Add location and onboarding columns to teachers
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Teaching assignments: multi-subject support
CREATE TABLE IF NOT EXISTS teaching_assignments (
    id CHAR(26) PRIMARY KEY, -- ULID
    teacher_id CHAR(26) NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    grade INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_assignment_grade CHECK (grade >= 1 AND grade <= 12)
);

CREATE INDEX IF NOT EXISTS idx_teaching_assignments_teacher ON teaching_assignments(teacher_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS teaching_assignments;
ALTER TABLE teachers DROP COLUMN IF EXISTS school_name;
ALTER TABLE teachers DROP COLUMN IF EXISTS province;
ALTER TABLE teachers DROP COLUMN IF EXISTS city;
ALTER TABLE teachers DROP COLUMN IF EXISTS onboarding_completed;
-- +goose StatementEnd
