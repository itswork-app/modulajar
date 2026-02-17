package worker

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"modulajar/apps/core-go/adapters/ai"
)

func TestLiveGeminiConnection(t *testing.T) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" || apiKey == "your-api-key" {
		t.Skip("Skipping live test: GEMINI_API_KEY not set")
	}

	fmt.Println("Testing Gemini Connection with key ending in ...", apiKey[len(apiKey)-4:])

	// Try gemini-2.0-flash (verified available)
	client := ai.NewGeminiClient(apiKey, "gemini-2.0-flash", 30000, 1024)

	start := time.Now()
	resp, err := client.Generate(context.Background(), ai.GenerateRequest{
		Prompt: "Say 'Hello ModulAjar' and nothing else.",
	})
	if err != nil {
		t.Fatalf("Gemini API call failed: %v", err)
	}
	duration := time.Since(start)

	fmt.Printf("Success!\nModel: %s\nDuration: %dms\nInput Tokens: %d\nOutput Tokens: %d\nContent: %s\nPre-Hash: %s\nPost-Hash: %s\n",
		resp.ModelName, duration.Milliseconds(), resp.TokenInput, resp.TokenOutput, resp.Content, resp.PromptHash, resp.OutputHash)

	if resp.Content == "" {
		t.Error("Content is empty")
	}
}
