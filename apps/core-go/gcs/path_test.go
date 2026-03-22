package gcs

import (
	"testing"
)

func TestArtifactPath(t *testing.T) {
	tests := []struct {
		name          string
		wid, pid, did string
		version       int
		expected      string
	}{
		{
			name:     "standard path",
			wid:      "ws-001",
			pid:      "PKG-SD4-S1-2026-ABCDEF-12345678",
			did:      "DOC-BI-SD4-S1-2026-ABCDEF-87654321",
			version:  1,
			expected: "artifacts/ws-001/PKG-SD4-S1-2026-ABCDEF-12345678/DOC-BI-SD4-S1-2026-ABCDEF-87654321/v1.pdf",
		},
		{
			name:     "version 2",
			wid:      "ws-002",
			pid:      "PKG-TEST",
			did:      "DOC-MTK-TEST",
			version:  2,
			expected: "artifacts/ws-002/PKG-TEST/DOC-MTK-TEST/v2.pdf",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ArtifactPath(tt.wid, tt.pid, tt.did, tt.version)
			if got != tt.expected {
				t.Errorf("ArtifactPath = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestArtifactPathDeterministic(t *testing.T) {
	a := ArtifactPath("ws-1", "pid-1", "did-1", 1)
	b := ArtifactPath("ws-1", "pid-1", "did-1", 1)
	if a != b {
		t.Errorf("NOT deterministic: %q != %q", a, b)
	}
}

func TestFullGCSURI(t *testing.T) {
	uri := FullGCSURI("modulajar-artifacts", "artifacts/ws-1/pid-1/did-1/v1.pdf")
	expected := "gcs://modulajar-artifacts/artifacts/ws-1/pid-1/did-1/v1.pdf"
	if uri != expected {
		t.Errorf("FullGCSURI = %q, want %q", uri, expected)
	}
}

func TestPublicURL(t *testing.T) {
	url := PublicURL("modulajar-artifacts", "artifacts/ws-1/pid-1/did-1/v1.pdf")
	expected := "https://storage.googleapis.com/modulajar-artifacts/artifacts/ws-1/pid-1/did-1/v1.pdf"
	if url != expected {
		t.Errorf("PublicURL = %q, want %q", url, expected)
	}
}

func TestParseGCSURI(t *testing.T) {
	bucket, obj, err := ParseGCSURI("gcs://my-bucket/path/to/file.pdf")
	if err != nil {
		t.Fatal(err)
	}
	if bucket != "my-bucket" {
		t.Errorf("bucket = %q, want %q", bucket, "my-bucket")
	}
	if obj != "path/to/file.pdf" {
		t.Errorf("object = %q, want %q", obj, "path/to/file.pdf")
	}
}

func TestParseGCSURIInvalid(t *testing.T) {
	_, _, err := ParseGCSURI("https://storage.googleapis.com/bucket/file.pdf")
	if err == nil {
		t.Error("expected error for non-gcs:// URI")
	}
}

func TestSanitizePath(t *testing.T) {
	// Path traversal should be stripped (filepath.Base)
	result := sanitizePath("../../../etc/passwd")
	if result != "passwd" {
		t.Errorf("sanitizePath = %q, want %q", result, "passwd")
	}

	// Double slashes and nested paths should be flattened
	result = sanitizePath("foo/bar")
	if result != "bar" {
		t.Errorf("sanitizePath = %q, want %q", result, "bar")
	}
}

func TestNewClientNoBucket(t *testing.T) {
	// Without GCS_BUCKET, client should be nil (graceful no-op)
	// We can't easily test with a real bucket in CI
	// Just verify the path builder functions work correctly
	t.Log("GCS client tests require GCS_BUCKET env; path builder tests cover logic")
}
