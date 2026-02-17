package ai

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GenerateRequest encapsulates input for generation
type GenerateRequest struct {
	Prompt string
}

// GenerateResponse encapsulates output and receipt data
type GenerateResponse struct {
	Content     string
	PromptHash  string // SHA256 of prompt
	OutputHash  string // SHA256 of content
	TokenInput  int
	TokenOutput int
	ModelName   string
	DurationMs  int64
}

// GeminiClient handles interaction with Google Gemini API
type GeminiClient struct {
	apiKey    string
	model     string
	timeout   time.Duration
	maxOutput int
	client    *http.Client
	baseURL   string // Allow overriding for tests
}

// NewGeminiClient creates a new client with configuration
func NewGeminiClient(apiKey, model string, timeoutMs, maxOutput int) *GeminiClient {
	if timeoutMs <= 0 {
		timeoutMs = 30000 // Default 30s
	}
	if maxOutput <= 0 {
		maxOutput = 2048 // Default
	}
	return &GeminiClient{
		apiKey:    apiKey,
		model:     model,
		timeout:   time.Duration(timeoutMs) * time.Millisecond,
		maxOutput: maxOutput,
		client:    &http.Client{Timeout: time.Duration(timeoutMs) * time.Millisecond},
		baseURL:   "https://generativelanguage.googleapis.com/v1beta/models",
	}
}

// Generate calls Gemini API with strict cost guards and receipt generation
func (c *GeminiClient) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	start := time.Now()

	// 1. Receipt Hash (Prompt)
	promptHash := sha256Sum(req.Prompt)

	// 2. Prepare Request
	url := fmt.Sprintf("%s/%s:generateContent?key=%s", c.baseURL, c.model, c.apiKey)

	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": req.Prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"maxOutputTokens": c.maxOutput,
			"temperature":     0.7, // Default creative but stable
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// 3. Execute Request with Timeout
	// Create a child context with timeout to enforce strict limit
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("gemini api call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini api error (status %d): %s", resp.StatusCode, string(body))
	}

	// 4. Parse Response
	var result geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from gemini")
	}

	content := result.Candidates[0].Content.Parts[0].Text

	// 5. Cost Guard (Token Check)
	// UsageMetadata might be missing in some responses, checking safety
	tokenOutput := 0
	tokenInput := 0
	if result.UsageMetadata != nil {
		tokenOutput = result.UsageMetadata.CandidatesTokenCount
		tokenInput = result.UsageMetadata.PromptTokenCount
	}

	if tokenOutput > c.maxOutput {
		return nil, fmt.Errorf("output token limit exceeded: %d > %d", tokenOutput, c.maxOutput)
	}

	// 6. Receipt Hash (Output)
	outputHash := sha256Sum(content)

	duration := time.Since(start)

	return &GenerateResponse{
		Content:     content,
		PromptHash:  promptHash,
		OutputHash:  outputHash,
		TokenInput:  tokenInput,
		TokenOutput: tokenOutput,
		ModelName:   c.model,
		DurationMs:  duration.Milliseconds(),
	}, nil
}

func sha256Sum(s string) string {
	h := sha256.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}

// Internal structures for JSON decoding
type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	UsageMetadata *struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
		TotalTokenCount      int `json:"totalTokenCount"`
	} `json:"usageMetadata"`
}
