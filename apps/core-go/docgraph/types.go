package docgraph

import (
	"modulajar/apps/core-go/planner"
)

// DocumentRecord represents a document to be created/upserted.
type DocumentRecord struct {
	ID          string `json:"id"` // ULID
	WorkspaceID string `json:"workspace_id"`
	PackageID   string `json:"package_id"`
	PublicID    string `json:"public_id"` // DID
	SubjectCode string `json:"subject_code"`
	Version     int    `json:"version"`
	Status      string `json:"status"`
}

// VersionRecord represents a document version to be created.
type VersionRecord struct {
	ID         string `json:"id"` // ULID
	DocumentID string `json:"document_id"`
	Version    int    `json:"version"`
	FilePath   string `json:"file_path"`
}

// DocGraphResult is the output of the document graph builder.
type DocGraphResult struct {
	Documents []DocumentRecord `json:"documents"`
	Versions  []VersionRecord  `json:"versions"`
}

// DocGraphInput is the input to the document graph builder.
type DocGraphInput struct {
	WorkspaceID string
	PackageID   string
	Kelas       string
	Semester    string
	TahunAjaran string
	DIDSecret   string
	PlanResult  *planner.PlannerResult
}
