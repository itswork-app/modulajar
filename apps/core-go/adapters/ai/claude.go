package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ClaudeClient handles interaction with Anthropic Claude API
type ClaudeClient struct {
	apiKey    string
	model     string
	timeout   time.Duration
	maxOutput int
	client    *http.Client
	baseURL   string // Allow overriding for tests
}

// NewClaudeClient creates a new Claude client with configuration
func NewClaudeClient(apiKey, model string, timeoutMs, maxOutput int) *ClaudeClient {
	if timeoutMs <= 0 {
		timeoutMs = 60000 // Default 60s — Claude bisa lebih lambat untuk konten panjang
	}
	if maxOutput <= 0 {
		maxOutput = 4096 // Default — lebih besar dari OpenAI/Gemini untuk modul ajar
	}
	return &ClaudeClient{
		apiKey:    apiKey,
		model:     model,
		timeout:   time.Duration(timeoutMs) * time.Millisecond,
		maxOutput: maxOutput,
		client:    &http.Client{Timeout: time.Duration(timeoutMs) * time.Millisecond},
		baseURL:   "https://api.anthropic.com/v1/messages",
	}
}

// Generate calls Anthropic Claude API
func (c *ClaudeClient) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	start := time.Now()

	// 1. Receipt Hash (Prompt)
	promptHash := sha256Sum(req.Prompt)

	// 2. Prepare Request
	payload := map[string]interface{}{
		"model":      c.model,
		"max_tokens": c.maxOutput,
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": req.Prompt,
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// 3. Execute Request with Timeout
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("claude api call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claude api error (status %d): %s", resp.StatusCode, string(body))
	}

	// 4. Parse Response
	var result claudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(result.Content) == 0 {
		return nil, fmt.Errorf("empty response from claude")
	}

	content := result.Content[0].Text

	// 5. Cost Guard
	tokenOutput := result.Usage.OutputTokens
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
		TokenInput:  result.Usage.InputTokens,
		TokenOutput: result.Usage.OutputTokens,
		ModelName:   result.Model,
		DurationMs:  duration.Milliseconds(),
	}, nil
}

// Internal structures for JSON decoding
type claudeResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	StopReason string `json:"stop_reason"`
}
