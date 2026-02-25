package main

import (
	"testing"
)

func TestRun(t *testing.T) {
	// 1. Success case (default)
	err := Run([]string{"validate"})
	if err != nil {
		t.Errorf("expected success, got %v", err)
	}

	// 2. File not found
	err = Run([]string{"validate", "/nonexistent"})
	if err == nil {
		t.Error("expected error for nonexistent file, got nil")
	}
}
