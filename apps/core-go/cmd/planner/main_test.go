package main

import (
	"testing"
)

func TestRun(t *testing.T) {
	// 1. Success case (default)
	err := Run([]string{"planner"})
	if err != nil {
		t.Errorf("expected success, got %v", err)
	}

	// 2. File not found
	err = Run([]string{"planner", "/nonexistent"})
	if err == nil {
		t.Error("expected error for nonexistent file, got nil")
	}
}
