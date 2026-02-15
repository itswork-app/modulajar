package docgraph

import (
	"sort"

	"math/rand"
	"time"

	"github.com/oklog/ulid/v2"
)

// deterministicULID generates a deterministic ULID from a seed string.
// This ensures idempotent document IDs across retries.
func deterministicULID(seed string) string {
	// Use a hash of the seed as the entropy source for determinism
	h := make([]byte, 0, len(seed))
	for _, b := range []byte(seed) {
		h = append(h, b)
	}

	// Create deterministic random source from seed
	var seedInt int64
	for i, b := range []byte(seed) {
		seedInt += int64(b) << (uint(i%8) * 8)
	}
	src := rand.New(rand.NewSource(seedInt))

	entropy := ulid.Monotonic(src, 0)
	t := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	id, err := ulid.New(ulid.Timestamp(t), entropy)
	if err != nil {
		// Fallback: just use the seed hash
		return seed[:26]
	}
	return id.String()
}

// BuildDocGraph creates the document graph for a package from the planner result.
// This is deterministic and idempotent — same input always produces same output.
func BuildDocGraph(input DocGraphInput) (*DocGraphResult, error) {
	if input.PlanResult == nil {
		return nil, nil
	}

	// Collect subject codes from the planner ATPs (sorted for determinism)
	subjectCodes := make([]string, 0, len(input.PlanResult.Atps))
	for _, atp := range input.PlanResult.Atps {
		subjectCodes = append(subjectCodes, atp.SubjectCode)
	}
	sort.Strings(subjectCodes)

	var docs []DocumentRecord
	var versions []VersionRecord

	for _, subjCode := range subjectCodes {
		// Deterministic document ULID from (package_id + subject_code)
		docSeed := input.PackageID + ":" + subjCode
		docID := deterministicULID(docSeed)

		// Issue DID
		did := IssueDID(
			input.DIDSecret,
			input.WorkspaceID,
			input.PackageID,
			docID,
			subjCode,
			input.Kelas,
			input.Semester,
			input.TahunAjaran,
		)

		docs = append(docs, DocumentRecord{
			ID:          docID,
			WorkspaceID: input.WorkspaceID,
			PackageID:   input.PackageID,
			PublicID:    did,
			SubjectCode: subjCode,
			Version:     1,
			Status:      "ready",
		})

		// Deterministic version ULID
		verSeed := docID + ":v1"
		verID := deterministicULID(verSeed)

		versions = append(versions, VersionRecord{
			ID:         verID,
			DocumentID: docID,
			Version:    1,
			FilePath:   "pending://",
		})
	}

	return &DocGraphResult{
		Documents: docs,
		Versions:  versions,
	}, nil
}
