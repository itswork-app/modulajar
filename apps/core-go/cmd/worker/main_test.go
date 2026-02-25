package main

import (
	"os"
	"testing"
)

func TestBootstrap(t *testing.T) {
	// Set environment variables for bootstrap
	os.Setenv("SKIP_SERVER", "true")
	os.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/postgres")
	os.Setenv("GEMINI_API_KEY", "test-key")
	os.Setenv("GCS_BUCKET", "test-bucket")

	defer os.Unsetenv("SKIP_SERVER")

	// Run bootstrap
	err := Bootstrap([]string{"worker"})
	if err != nil {
		t.Errorf("expected success, got %v", err)
	}
}

func TestBootstrap_FailDB(t *testing.T) {
	os.Setenv("SKIP_SERVER", "true")
	os.Setenv("DATABASE_URL", "postgres://invalid")
	defer os.Unsetenv("SKIP_SERVER")

	err := Bootstrap([]string{"worker"})
	if err == nil {
		t.Error("expected error for invalid DB URL, got nil")
	}
}
