-- +goose Up
-- +goose StatementBegin

-- 1. Workspaces
CREATE TABLE workspaces (
    id CHAR(26) PRIMARY KEY, -- ULID
    clerk_org_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Workspace Members
CREATE TABLE workspace_members (
    id CHAR(26) PRIMARY KEY, -- ULID
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
    clerk_user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, clerk_user_id)
);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);

-- 3. Curriculum Packs
CREATE TABLE curriculum_packs (
    id CHAR(26) PRIMARY KEY, -- ULID
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    jenjang VARCHAR(50) NOT NULL,
    kelas VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Subjects
CREATE TABLE subjects (
    id CHAR(26) PRIMARY KEY, -- ULID
    curriculum_pack_id CHAR(26) NOT NULL REFERENCES curriculum_packs(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL
);
CREATE INDEX idx_subjects_curriculum_pack_id ON subjects(curriculum_pack_id);

-- 5. Outcomes
CREATE TABLE outcomes (
    id CHAR(26) PRIMARY KEY, -- ULID
    subject_id CHAR(26) NOT NULL REFERENCES subjects(id),
    code VARCHAR(50) NOT NULL,
    description TEXT NOT NULL
);
CREATE INDEX idx_outcomes_subject_id ON outcomes(subject_id);

-- 6. Packages (PID Container)
CREATE TABLE packages (
    id CHAR(26) PRIMARY KEY, -- ULID
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
    public_id VARCHAR(255) UNIQUE NOT NULL,
    kelas VARCHAR(50) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    tahun_ajaran VARCHAR(50) NOT NULL,
    teacher_name VARCHAR(255) NOT NULL,
    school_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    regenerate_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_packages_workspace_id ON packages(workspace_id);
CREATE INDEX idx_packages_public_id ON packages(public_id);

-- 7. Documents (DID)
CREATE TABLE documents (
    id CHAR(26) PRIMARY KEY, -- ULID
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
    package_id CHAR(26) NOT NULL REFERENCES packages(id),
    public_id VARCHAR(255) UNIQUE NOT NULL,
    subject_code VARCHAR(50) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_documents_workspace_id ON documents(workspace_id);
CREATE INDEX idx_documents_package_id ON documents(package_id);
CREATE INDEX idx_documents_public_id ON documents(public_id);

-- 8. Document Versions
CREATE TABLE document_versions (
    id CHAR(26) PRIMARY KEY, -- ULID
    document_id CHAR(26) NOT NULL REFERENCES documents(id),
    version INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);

-- 9. Generation Jobs
CREATE TABLE generation_jobs (
    id CHAR(26) PRIMARY KEY, -- ULID
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
    package_id CHAR(26) NOT NULL REFERENCES packages(id),
    status VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_generation_jobs_workspace_id ON generation_jobs(workspace_id);
CREATE INDEX idx_generation_jobs_idempotency_key ON generation_jobs(idempotency_key);

-- 10. Wallet Ledger (Append-Only)
CREATE TABLE wallet_ledger (
    id CHAR(26) PRIMARY KEY, -- ULID
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
    type VARCHAR(50) NOT NULL,
    amount INT NOT NULL,
    reference VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wallet_ledger_workspace_id ON wallet_ledger(workspace_id);

-- 11. Receipts
CREATE TABLE receipts (
    id CHAR(26) PRIMARY KEY, -- ULID
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
    external_ref VARCHAR(255) UNIQUE NOT NULL,
    amount INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_receipts_workspace_id ON receipts(workspace_id);
CREATE INDEX idx_receipts_external_ref ON receipts(external_ref);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS wallet_ledger;
DROP TABLE IF EXISTS generation_jobs;
DROP TABLE IF EXISTS document_versions;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS outcomes;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS curriculum_packs;
DROP TABLE IF EXISTS workspace_members;
DROP TABLE IF EXISTS workspaces;
-- +goose StatementEnd
