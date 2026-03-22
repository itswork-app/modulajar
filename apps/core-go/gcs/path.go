// Package gcs provides GCS path building and upload functionality for Modulajar artifacts.
package gcs

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ArtifactPath builds a deterministic GCS object path for a document artifact.
// Format: artifacts/{workspaceId}/{pid}/{did}/v{version}.pdf
func ArtifactPath(workspaceID, pid, did string, version int) string {
	return fmt.Sprintf("artifacts/%s/%s/%s/v%d.pdf",
		sanitizePath(workspaceID),
		sanitizePath(pid),
		sanitizePath(did),
		version,
	)
}

// FullGCSURI returns the full gcs:// URI for an artifact.
func FullGCSURI(bucket, objectPath string) string {
	return fmt.Sprintf("gcs://%s/%s", bucket, objectPath)
}

// PublicURL returns the public HTTPS URL for a GCS object (if bucket is public).
func PublicURL(bucket, objectPath string) string {
	return fmt.Sprintf("https://storage.googleapis.com/%s/%s", bucket, objectPath)
}

// ParseGCSURI extracts bucket and object path from a gcs:// URI.
func ParseGCSURI(uri string) (bucket, objectPath string, err error) {
	if !strings.HasPrefix(uri, "gcs://") {
		return "", "", fmt.Errorf("not a gcs:// URI: %s", uri)
	}
	rest := strings.TrimPrefix(uri, "gcs://")
	parts := strings.SplitN(rest, "/", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid gcs URI format: %s", uri)
	}
	return parts[0], parts[1], nil
}

// sanitizePath ensures the ID is a safe single path segment.
func sanitizePath(s string) string {
	// filepath.Base returns the last element of the path.
	// This effectively strips directory traversal and nested paths.
	// e.g. "../../../etc/passwd" -> "passwd"
	// e.g. "foo/bar" -> "bar"
	clean := filepath.Base(s)
	if clean == "." || clean == string(filepath.Separator) {
		return "invalid"
	}
	return clean
}
