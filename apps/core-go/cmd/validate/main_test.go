package main

import (
	"testing"
)

func TestValidateExit(t *testing.T) {
	// Success path
	err := Run([]string{"validate"})
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	// Error path
	err = Run([]string{"validate", "nonexistentdir"})
	if err == nil {
		t.Error("Expected error because target directory not exist")
	}
}
