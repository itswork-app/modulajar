package main

import (
	"os"
	"testing"
)

func TestBootstrap(t *testing.T) {
	// Set environment variables for bootstrap if not already set (e.g. locally)
	os.Setenv("SKIP_SERVER", "true")
	if os.Getenv("DATABASE_URL") == "" {
		os.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/postgres")
	}
	if os.Getenv("GEMINI_API_KEY") == "" {
		os.Setenv("GEMINI_API_KEY", "test-key")
	}
	if os.Getenv("GCS_BUCKET") == "" {
		os.Setenv("GCS_BUCKET", "test-bucket")
	}

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
