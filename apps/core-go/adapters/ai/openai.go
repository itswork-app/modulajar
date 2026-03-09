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

// OpenAIClient handles interaction with OpenAI API
type OpenAIClient struct {
	apiKey    string
	model     string
	timeout   time.Duration
	maxOutput int
	client    *http.Client
}

// NewOpenAIClient creates a new client with configuration
func NewOpenAIClient(apiKey, model string, timeoutMs, maxOutput int) *OpenAIClient {
	if timeoutMs <= 0 {
		timeoutMs = 60000 // Default 60s
	}
	if maxOutput <= 0 {
		maxOutput = 2048 // Default
	}
	return &OpenAIClient{
		apiKey:    apiKey,
		model:     model,
		timeout:   time.Duration(timeoutMs) * time.Millisecond,
		maxOutput: maxOutput,
		client:    &http.Client{Timeout: time.Duration(timeoutMs) * time.Millisecond},
	}
}

// Generate calls OpenAI API
func (c *OpenAIClient) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	start := time.Now()

	// 1. Receipt Hash (Prompt)
	promptHash := sha256Sum(req.Prompt)

	// 2. Prepare Request
	url := "https://api.openai.com/v1/chat/completions"

	payload := map[string]interface{}{
		"model": c.model,
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": req.Prompt,
			},
		},
		"max_tokens":  c.maxOutput,
		"temperature": 0.7,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// 3. Execute Request with Timeout
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("openai api call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openai api error (status %d): %s", resp.StatusCode, string(body))
	}

	// 4. Parse Response
	var result openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("empty response from openai")
	}

	content := result.Choices[0].Message.Content

	// 5. Receipt Hash (Output)
	outputHash := sha256Sum(content)

	duration := time.Since(start)

	return &GenerateResponse{
		Content:     content,
		PromptHash:  promptHash,
		OutputHash:  outputHash,
		TokenInput:  result.Usage.PromptTokens,
		TokenOutput: result.Usage.CompletionTokens,
		ModelName:   c.model,
		DurationMs:  duration.Microseconds() / 1000,
	}, nil
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}
