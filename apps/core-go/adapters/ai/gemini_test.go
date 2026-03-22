package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestGeminiClient_Generate_Success(t *testing.T) {
	// Mock Server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		// Verify payload exists
		var payload map[string]interface{}
		json.NewDecoder(r.Body).Decode(&payload)
		if payload["contents"] == nil {
			t.Error("missing contents in payload")
		}

		// Return success response
		response := map[string]interface{}{
			"candidates": []map[string]interface{}{
				{
					"content": map[string]interface{}{
						"parts": []map[string]interface{}{
							{"text": "Hello world from Gemini"},
						},
					},
					"finishReason": "STOP",
				},
			},
			"usageMetadata": map[string]interface{}{
				"promptTokenCount":     10,
				"candidatesTokenCount": 5,
				"totalTokenCount":      15,
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewGeminiClient("dummy-key", "gemini-test", 1000, 100)
	client.baseURL = server.URL // Override for test

	resp, err := client.Generate(context.Background(), GenerateRequest{Prompt: "Hi"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Content != "Hello world from Gemini" {
		t.Errorf("content mismatch: %s", resp.Content)
	}
	if resp.TokenInput != 10 || resp.TokenOutput != 5 {
		t.Errorf("token usage mismatch: %d/%d", resp.TokenInput, resp.TokenOutput)
	}
	if resp.PromptHash == "" || resp.OutputHash == "" {
		t.Error("hashes missing")
	}
}

func TestGeminiClient_Generate_Timeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond) // Delay
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Timeout shorter than delay
	client := NewGeminiClient("key", "model", 10, 100) // 10ms timeout
	client.baseURL = server.URL

	_, err := client.Generate(context.Background(), GenerateRequest{Prompt: "Hi"})
	if err == nil {
		t.Fatal("expected timeout error")
	}
}

func TestGeminiClient_Generate_CostGuard(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"candidates": []map[string]interface{}{
				{
					"content": map[string]interface{}{
						"parts": []map[string]interface{}{
							{"text": "Too long content..."},
						},
					},
				},
			},
			"usageMetadata": map[string]interface{}{
				"promptTokenCount":     10,
				"candidatesTokenCount": 200, // Exceeds limit
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewGeminiClient("key", "model", 1000, 100) // Max 100 tokens
	client.baseURL = server.URL

	_, err := client.Generate(context.Background(), GenerateRequest{Prompt: "Hi"})
	if err == nil {
		t.Fatal("expected cost guard error")
	}
	// Error check could be more specific
}
func TestGeminiClient_Generate_APIStatusError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("invalid prompt"))
	}))
	defer server.Close()

	client := NewGeminiClient("key", "model", 1000, 100)
	client.baseURL = server.URL

	_, err := client.Generate(context.Background(), GenerateRequest{Prompt: "Hi"})
	if err == nil || !strings.Contains(err.Error(), "status 400") {
		t.Fatalf("expected 400 error, got %v", err)
	}
}

func TestGeminiClient_Generate_EmptyResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"candidates": []interface{}{},
		})
	}))
	defer server.Close()

	client := NewGeminiClient("key", "model", 1000, 100)
	client.baseURL = server.URL

	_, err := client.Generate(context.Background(), GenerateRequest{Prompt: "Hi"})
	if err == nil || !strings.Contains(err.Error(), "empty response") {
		t.Fatalf("expected empty response error, got %v", err)
	}
}

func TestGeminiClient_Generate_MalformedJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{invalid: json}`))
	}))
	defer server.Close()

	client := NewGeminiClient("key", "model", 1000, 100)
	client.baseURL = server.URL

	_, err := client.Generate(context.Background(), GenerateRequest{Prompt: "Hi"})
	if err == nil {
		t.Fatal("expected decode error")
	}
}

func TestGeminiClient_Generate_MissingUsageMetadata(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"candidates": []map[string]interface{}{
				{
					"content": map[string]interface{}{
						"parts": []map[string]interface{}{
							{"text": "OK"},
						},
					},
				},
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewGeminiClient("key", "model", 1000, 100)
	client.baseURL = server.URL

	resp, err := client.Generate(context.Background(), GenerateRequest{Prompt: "Hi"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.TokenInput != 0 || resp.TokenOutput != 0 {
		t.Errorf("expected 0 tokens, got %d/%d", resp.TokenInput, resp.TokenOutput)
	}
}
