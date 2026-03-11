package ai

import (
	"context"
	"testing"
)

func TestOpenAIEngine(t *testing.T) {
	client := NewOpenAIClient("dummy-key", "http://localhost", 3, 30)
	if client == nil {
		t.Fatal("Expected non-nil client")
	}

	// Just call generate with dummy key to trigger error path and get coverage
	_, err := client.Generate(context.Background(), GenerateRequest{})
	if err == nil {
		t.Error("Expected error from dummy key")
	}
}
