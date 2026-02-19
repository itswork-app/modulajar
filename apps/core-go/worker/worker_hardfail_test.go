package worker

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"testing"

	"modulajar/apps/core-go/db"
)

// Simulated DB error mock
type ErrorMetadataUpdater struct {
	ShouldFail bool
}

func (e *ErrorMetadataUpdater) UpdateJobMetadata(ctx context.Context, jobID string, metadata map[string]interface{}) error {
	if e.ShouldFail {
		return fmt.Errorf("simulated metadata persistence failure")
	}
	return db.UpdateJobMetadata(ctx, jobID, metadata)
}

func TestExecuteJob_PDFFailure_HardFail(t *testing.T) {
	// 1. Force "Chrome not found" by wiping PATH temporarily
	oldPath := os.Getenv("PATH")
	defer os.Setenv("PATH", oldPath)
	os.Setenv("PATH", "") // Wipe path so 'google-chrome' or 'chromium' is not found

	// Also wipe CHROME_BIN if set
	oldChromeBin := os.Getenv("CHROME_BIN")
	if oldChromeBin != "" {
		defer os.Setenv("CHROME_BIN", oldChromeBin)
		os.Setenv("CHROME_BIN", "")
	}

	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, err := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)

	// Expect strict failure (err returned from ExecuteJob or result.Status=failed)
	if err == nil {
		if result != nil && result.Status == "completed" {
			t.Fatal("Expected failure due to missing Chrome, but job completed (Partial Success prevented!)")
		}
		t.Fatalf("Expected error return from ExecuteJob, got nil. Result status: %v", result.Status)
	}

	// Verify error message
	expected := "Chrome/Chromium not found"
	if !strings.Contains(err.Error(), expected) {
		t.Errorf("Expected error containing %q, got: %v", expected, err)
	} else {
		t.Logf("Success: Job hard-failed as expected with error: %v", err)
	}
}

func TestExecuteJob_MetadataFailure_HardFail(t *testing.T) {
	// Only run if we can assume PDF generation succeeds (so Chrome exists).
	// We can't easily mock GeneratePDF without refactoring it to an interface too.
	// But we can try running it. If IsChromeAvailable() is false, this test will fail earlier
	// (which is covered by test above), so we should skip if it fails on Chrome.

	mockUpdater := &ErrorMetadataUpdater{ShouldFail: true}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	result, err := ExecuteJob(context.Background(), basePayload(), logger, nil, mockUpdater)

	if err != nil {
		if strings.Contains(err.Error(), "simulated metadata persistence failure") {
			t.Log("Success: Hard failed on metadata persistence")
			return
		}
		if strings.Contains(err.Error(), "Chrome") {
			t.Skip("Skipping metadata fail test because Chrome is missing")
		}
		t.Fatalf("Unexpected error: %v", err)
	}

	if result != nil && result.Status == "completed" {
		t.Fatal("Expected failure on metadata persistence, but job completed")
	}
	t.Fatal("Expected failure on metadata persistence")
}
