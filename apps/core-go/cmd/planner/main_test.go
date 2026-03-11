package main

import (
	"testing"
)

func TestMainExit(t *testing.T) {
	// Success path
	err := Run([]string{"planner"})
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	// Error path
	err = Run([]string{"planner", "-pack", "nonexistent.json"})
	if err == nil {
		t.Error("Expected error because pack file not exist")
	}
}
